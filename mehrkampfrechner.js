/* Javascript Mehrkampfrechner (c)2010 Daniel Kirsch */
(function($) {  
// business logic here

var parseSeconds = function (s) {
  return parseFloat(s.replace(',','.'));
}

var showSeconds = function (num) {
  return Math.floor(num * Math.pow(10, 2)) / Math.pow(10, 2);
}

var parseMeters = function (m) {
  return parseFloat(m.replace(',','.'));
}

var showMeters = function (num) {
  return Math.ceil(num * Math.pow(10, 2)) / Math.pow(10, 2);
}

var coderange = function(from, to) { return function(code) { return (code >= from && code <= to); } }
var tab = coderange(9,9)
var atoz = coderange(65,90);
var digit = coderange(48,57);
var arrows = coderange(37,40); // left up right down

/* helper functions */
$.fn.extend({
  set: function() {
    $(this).removeClass().addClass("set");
  },
  calculate: function(val) {
    $(this).removeClass().addClass("calculated").val(val);
  },
  unset: function(val) {
    if (val) {      
      $(this).removeClass().addClass("unset").val(val);
    }
    else {
      $(this).removeClass().addClass("unset").val('');
    }
  },
  isSet: function() {
    return this.hasClass("set");
  },
  isCalculated: function() {
    return this.hasClass("calculated");
  },
  isUnset: function() {
    return this.hasClass("unset");
  },
  disable: function() {
    this.attr('disabled', true);
  },
  enable: function() {
    this.attr('disabled', false);
  }
});

/*
gets arguments of form
{
  name: "50m",
  id: "50m",
  pt2disc: formulasM['50m_pt2val'],
  disc2pt: formulasM['50m_val2pt'],
  parsedisc: parseFloat,
  showdisc: _.identity,
  unit: "s"
}
*/

$.fn.mehrkampfrechner = function(name, disciplines) {  
  var rechner = this;
  var ns = $(this).attr('id');
    
  // set up the html
  
  var t = ''
  t+= '<h2>{{name}}</h2>'
  t+= '<table>'
  t+= '<thead><tr><th>Disziplin</th><th>Leistung</th><th>Einheit</th><th>Punkte</th></tr></thead>'
  t+= '<tfoot><tr><td colspan="3"><label for="{{ns}}-total">Gesamt</label></td><td class="total"><input id="{{ns}}-total" type="text" tabindex="2"/></td></tr></tfoot>'
  t+= '{{#disciplines}}'
  t+= '<tr>'
  t+= '<td class="name"><label for="{{ns}}-{{id}}">{{name}}</label></td>'
  t+= '<td class="discipline"><input id="{{ns}}-{{id}}" type="text" tabindex="1"/></td><td class="unit">{{unit}}</td>'
  t+= '<td class="pts"><input id="{{ns}}-{{id}}pts" type="text" tabindex="3"/></td>'
  t+= '</tr>'
  t+= '{{/disciplines}}'
  t+= '</table>'
  var html = $.mustache(t, { disciplines: disciplines, name: name, ns: ns }); 
  
  $(rechner).html(html);

  var total = $('#'+ns+'-total', rechner);
  
  // helper
  var disenable = function () {
    // disenable pts/disc
    if (total.isSet() && $('td.pts input.unset', rechner).size() == 1) {
      $('td.pts input.unset, td.discipline input.unset', rechner).disable();
    }
    else {
      $('td.pts input.unset, td.discipline input.unset', rechner).enable();
    }
    // disenable total
    if ($('td.pts input.unset', rechner).size() == 0) {
      total.disable();
    }
    else {
      total.enable();
    }
  }
  
  var parsept = parseInt;
  var showpt = function (num) { return Math.floor(num) + '' };
  var sharequeue; // this is used to distribute the left points over the unset pts
  
  var fillShareQueue = function () {
    var set = $("td.pts input:not(.unset)", rechner);
    var unset = $("td.pts input.unset", rechner);
    // get points already achieved
    var currentpts = 0;
    set.each(function(index, pts) {
      currentpts += parsept($(pts).val());
    });
    // get goal
    var goalpts = parsept(total.val());
    // left
    var leftpts = goalpts - currentpts;
    // must be spreaded across
    var num = unset.size();
    // fill the sharequeue so that foldl(+, sharequeue) == leftpts
    // initialize
    sharequeue = [];
    for (var i = 0; i < num; i++) {
      sharequeue.push(0);
    }
    // fill
    var j = 0;
    while (leftpts > 0) {
      sharequeue[j%num]++;
      j++;
      leftpts--;
    }
  }
  
  // setup the interaction
  $.each(disciplines, function(index, discipline) {
    // setup disc interaction
    $('#'+ns+'-'+discipline.id, rechner).keyup(function(evt) {
      if (tab(evt.which)||arrows(evt.which)) { return; }
      var val = $(this).val();
      if (val === '') {
        $(this).unset();
      }
      else {
        $(this).set();
      }
      $('#'+ns+'-'+discipline.id+'pts', rechner).trigger('update');
      total.trigger('update');
      fillShareQueue();
      $('td.pts input.unset', rechner).trigger('update');
      $('td.discipline input.unset', rechner).trigger('update');
      disenable();
    });
    // setup pts interaction
    $('#'+ns+'-'+discipline.id+'pts', rechner).keyup(function(evt) {
      if (tab(evt.which)||arrows(evt.which)) { return; }
      var val = $(this).val();
      if (val === '') {
        $(this).unset();
      }
      else {
        $(this).set();
      }
      $('#'+ns+'-'+discipline.id, rechner).trigger('update');
      total.trigger('update');
      fillShareQueue();
      $('td.pts input.unset', rechner).trigger('update');
      $('td.discipline input.unset', rechner).trigger('update');
      disenable();
    });    
  });

  total.keyup(function(evt) {
    if (tab(evt.which)||arrows(evt.which)) { return; }
    var val = $(this).val();
    if (val === '') {
      $(this).unset();
    }
    else {
      $(this).set();
    }
    fillShareQueue();
    $('td.pts input.unset', rechner).trigger('update');
    $('td.discipline input.unset', rechner).trigger('update');
    disenable();
  });    
  
  // setup update events for pts and disc
  $.each(disciplines, function(index, discipline) {
    // setup update event for disc
    /*
    update for disc ~>
      if pts is set
        update from pts
      else
        unset
    */
    $('#'+ns+'-'+discipline.id, rechner).bind('update', function() {
      var pts = $('#'+ns+'-'+discipline.id+'pts', rechner);
      if (pts.isSet()) {
        var calculate = _.compose(discipline.showdisc, discipline.pt2disc, parsept);
        $(this).calculate(calculate(pts.val()));
      }
      else if (total.isSet()) {
        var calculate = _.compose(discipline.showdisc, discipline.pt2disc, parsept);
        $(this).unset(calculate(pts.val()));
      }
      else {
        $(this).unset();
      }
    });
    // setup update event for pts
    /*
    update for pts ~>
      if disc is set
        update from disc
      else if total is set
        update from total
      else
        unset
    */
    $('#'+ns+'-'+discipline.id+'pts', rechner).bind('update', function() {
      var disc = $('#'+ns+'-'+discipline.id, rechner);
      // FIXME do I need if $(this).isSet() ?
      if (disc.isSet()) {
        var calculate = _.compose(showpt, discipline.disc2pt, discipline.parsedisc);
        $(this).calculate(calculate(disc.val()));
      }
      else if (total.isSet()) {
        var calculate = function() {
          return showpt(sharequeue.pop());
        }
        $(this).unset(calculate(total.val()));
      }
      else {
        $(this).unset();
      }
    });
  });
      
  // setup update event for total
  /*
  update for total ~>
    if no pts are unset
      update from all pts
    else if total is set
      do nothing
    else
      do nothing
  */
  total.bind('update', function() {
    if ($('td.pts input.unset', rechner).size() == 0) {
      var calculate = function () {
        var totalpts = 0;
        $("td.pts input", rechner).each(function(index, pts) {
          totalpts += parsept($(pts).val());
        });
        return showpt(totalpts);
      }
      $(this).calculate(calculate());
    }
    else if (!$(this).isSet()) {
      $(this).unset();
    }
    // else do nothing
  });
  
  // now unset everything
  $.each(disciplines, function(index, discipline) {
    // setup disc interaction
    $('#'+ns+'-'+discipline.id, rechner).unset();
    // setup pts interaction
    $('#'+ns+'-'+discipline.id+'pts', rechner).unset();
  });
  total.unset();
  
  // preselect text
  $('input', rechner).focus(function () {
    $(this).select();
  });
  
}

/*** formulas ***/

var run_val2pt = function (d,a,c) { return function(m) { return Math.floor((d/m-a)/c); } }
var run_pt2val = function (d,a,c) { return function(m) { return d/(m*c+a); } }
var jump_val2pt = function (a,c) { return function(m) { return Math.floor((Math.sqrt(m)-a)/c); } }
var jump_pt2val = function (a,c) { return function(m) { return Math.pow(m*c+a, 2); } }
var throw_val2pt = jump_val2pt;
var throw_pt2val = jump_pt2val;

var formulas = {
  m: {
      "50m_val2pt": run_val2pt(50, 3.79, 0.0069),
      "50m_pt2val": run_pt2val(50, 3.79, 0.0069),
      // "60 m": frun(60, 4.20312, 0.00639),
    //  "75 m": [75, 4.1, 0.00664],
      // "100m": frun(100, 4.34100, 0.00676),
      // "100mInv": frunInv(100, 4.34100, 0.00676),
    //  "200 m" => [200, 3.60400, 0.00760],
    //  "400 m" => [400, 2.96700, 0.00716],
    //  "800 m" => [800, 2.32500, 0.00644],
    //  "1.000 m" => [1000, 2.15800, 0.00600],
    //  # TODO 1500-5000
    //  "60 m Hürden" => [60, 3.04, 0.0056],
    //  # TODO andere Hürden
    //  "4 x 75 m Staffel" => [300, 4.1, 0.00338],
      "Weit_val2pt": jump_val2pt(1.15028, 0.00219),
      "Weit_pt2val": jump_pt2val(1.15028, 0.00219),
      "hoch_val2pt": jump_val2pt(0.841, 0.0008),
      "hoch_pt2val": jump_pt2val(0.841, 0.0008),
      "200g_val2pt": throw_val2pt(1.936, 0.0124),
      "200g_pt2val": throw_pt2val(1.936, 0.0124) 
  }
}

var iaaf_run = function (a,b,c) {
  var fn = function (m) { return Math.floor(a * Math.pow(b-m, c)); };
  fn.inverse = function (pt) { return b - Math.pow(pt/a,1/c); };
  return fn;
}
var iaaf_throw = function (a,b,c) {
  var fn = function (m) { return Math.floor(a * Math.pow(m-b, c)); };
  fn.inverse = function (pt) { return b + Math.pow(pt/a,1/c); };
  return fn;
}
var iaaf_jump = function (a,b,c) {
  var fn = function (m) { return iaaf_throw(a,b,c)(m*100); };
  fn.inverse = function (m) { return iaaf_throw(a,b,c).inverse(m)/100; }
  return fn;
}
var iaaf_formulas = {
  m: {
    _60m: iaaf_run(58.015, 11.5, 1.81),
    _100m: iaaf_run(25.4347, 18, 1.81),
    _200m: iaaf_run(5.8425, 38, 1.81),
    _300m: iaaf_run(2.58503, 60.1, 1.81),
    _400m: iaaf_run(1.53775, 82, 1.81),
    _800m: iaaf_run(0.13279, 235, 1.85),
    _1000m: iaaf_run(0.08713, 305.5, 1.85),
    _1500m: iaaf_run(0.03768, 480, 1.85),
    _3000m: iaaf_run(0.0105, 1005, 1.85),
    _5000m: iaaf_run(0.00419, 1680, 1.85),
    _1000m: iaaf_run(0.000415, 4245, 1.9),
    _3000mHi: iaaf_run(0.00511, 1155, 1.9),
    _60mH: iaaf_run(20.5173, 15.5, 1.92),
    _110mH: iaaf_run(5.74325, 28.5, 1.92),
    _200mH: iaaf_run(3.495, 45.5, 1.81),
    _400mH: iaaf_run(1.1466, 92, 1.81),
    _high: iaaf_jump(0.8465, 75, 1.42),
    _pole: iaaf_jump(0.2797, 100, 1.35),
    _long: iaaf_jump(0.14354, 220, 1.40),
    _triple: iaaf_jump(0.06533, 640, 1.4),
    _shot: iaaf_throw(51.39, 1.5, 1.05),
    _disc: iaaf_throw(12.91, 4, 1.10),
    _javelin: iaaf_throw(10.14,7, 1.08),
    _hammer: iaaf_throw(13.0449, 7, 1.05)
  }
};

var rechner = [
  {
    name: "Dreikampf SB",
    id: "dsb",
    disciplines: [
      {
        name: "50m",
        id: "50m",
        pt2disc: formulas.m['50m_pt2val'],
        disc2pt: formulas.m['50m_val2pt'],
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "Weitsprung",
        id: "weit",
        pt2disc: formulas.m['Weit_pt2val'],
        disc2pt: formulas.m['Weit_val2pt'],
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "200g Schlagball",
        id: "200g",
        pt2disc: formulas.m['200g_pt2val'],
        disc2pt: formulas.m['200g_val2pt'],
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      }
    ]
  },
  {
    name: "Vierkampf SB",
    id: "vsb",
    disciplines: [
      {
        name: "50m",
        id: "50m",
        pt2disc: formulas.m['50m_pt2val'],
        disc2pt: formulas.m['50m_val2pt'],
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "Weitsprung",
        id: "weit",
        pt2disc: formulas.m['Weit_pt2val'],
        disc2pt: formulas.m['Weit_val2pt'],
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {
        name: "Hochsprung",
        id: "hoch",
        pt2disc: formulas.m['hoch_pt2val'],
        disc2pt: formulas.m['hoch_val2pt'],
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "200g Schlagball",
        id: "200g",
        pt2disc: formulas.m['200g_pt2val'],
        disc2pt: formulas.m['200g_val2pt'],
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      }
    ]
  },
  {
    name: "Zehnkampf MHK",
    id: "zkmhk",
    disciplines: [
      {
        name: "100m",
        id: "100m",
        disc2pt: iaaf_formulas.m._100m,
        pt2disc: iaaf_formulas.m._100m.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "Weitsprung",
        id: "weit",
        disc2pt: iaaf_formulas.m._long,
        pt2disc: iaaf_formulas.m._long.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "Kugelstoßen",
        id: "kugel",
        disc2pt: iaaf_formulas.m._shot,
        pt2disc: iaaf_formulas.m._shot.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "Hochsprung",
        id: "hoch",
        disc2pt: iaaf_formulas.m._high,
        pt2disc: iaaf_formulas.m._high.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {
        name: "400m",
        id: "400m",
        disc2pt: iaaf_formulas.m._400m,
        pt2disc: iaaf_formulas.m._400m.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "110m Hürden",
        id: "110mH",
        disc2pt: iaaf_formulas.m._110mH,
        pt2disc: iaaf_formulas.m._110mH.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {              
        name: "Diskus",
        id: "diskus",
        disc2pt: iaaf_formulas.m._disc,
        pt2disc: iaaf_formulas.m._disc.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "Stabhochsprung",
        id: "stab",
        disc2pt: iaaf_formulas.m._pole,
        pt2disc: iaaf_formulas.m._pole.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "Speer",
        id: "speer",
        disc2pt: iaaf_formulas.m._javelin,
        pt2disc: iaaf_formulas.m._javelin.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {
        name: "1500m",
        id: "1500m",
        disc2pt: iaaf_formulas.m._1500m,
        pt2disc: iaaf_formulas.m._1500m.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      }
    ]
  }
]
/* templates */

var template = '\
<select class="nav" tabindex="1">{{#rechner}}\
<option value="{{id}}">{{name}}</option>{{/rechner}}\
<option value="">Weitere Mehrkämpfe folgen...</option>\
</select>{{#rechner}}\
<div id="{{id}}" class="rechner"></div>{{/rechner}}\
<small><a href="http://www.kirel.de/mehrkampfrechner">Mehrkampfrechner</a> &copy;2010 Daniel Kirsch</small>';
var html = $.mustache(template, { rechner: rechner }); 

document.write('<div id="kirel-mehrkampf-rechner"></div>');
$('#kirel-mehrkampf-rechner').html(html);
$.each(rechner, function (i, r) {
  $('#'+r.id).mehrkampfrechner(r.name, r.disciplines);
})

/*** setup navigation ***/
$('.rechner:not(:first)', '#kirel-mehrkampf-rechner').hide();
$('#kirel-mehrkampf-rechner select.nav').change(function () {
  if ($(this).val()) {
    $('.rechner', '#kirel-mehrkampf-rechner').hide();
    $('#'+$(this).val(), '#kirel-mehrkampf-rechner').show();    
  }
})

/*** adding style ***/
s = '\
<style>\
  #mehrkampfrechner {\
    display: table;\
  }\
  div.discpts {\
    display: table-row;\
  }\
  div.discipline {\
    display: table-cell;\
  }\
  div.pts {\
    display: table-cell;\
  }\
  input.set {\
    color: black;\
  }\
  input.calculated {\
    color: green;\
  }\
  input.unset {\
    color: gray;\
  }\
  td.discipline input {\
    text-align: right;\
  }\
  </style>\
';
$('head').prepend(s);
/*** sneak in ga ***/
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-8668142-4']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

})(jQuery);