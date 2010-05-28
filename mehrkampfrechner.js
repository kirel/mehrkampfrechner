/* Javascript Mehrkampfrechner (c)2010 Daniel Kirsch */
(function($, _) {
// business logic here

var parseSeconds = function (s) {
  return parseFloat(s.replace(',','.'));
}

var showSeconds = function (num) {
  return Math.floor(num * Math.pow(10, 2)) / Math.pow(10, 2);
}

var parseMinutes = function (s) {
  return _(s.replace(',','.').split(':')).reduce(0, function(res, part) {
    return (res * 60) + parseFloat(part);
  });
}

var showMinutes = function(secs) {
  var s = secs * 100 % 6000 / 100;
  if (s < 10) {
    s = '0' + showSeconds(s);
  }
  else {
    s = showSeconds(s);    
  }
  var m = Math.floor(secs/60);
  return [m,s].join(':');
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
  t+= '<small><a class="getcalculatorlink" href="#{{id}}">Link</a> zum Mehrkampf</small>'
  var html = $.mustache(t, { disciplines: disciplines, name: name, ns: ns }); 
  
  $(rechner).html(html);

  /*** link functionality ***/
  
  var getcaluclatorlink = $('.getcalculatorlink', rechner).bind('update', function() {
    var sero = {};
    $('input.set', rechner).each(function (_, el) {
      sero[$(el).attr('id')] = $(el).val();
    });
    $(this).attr('href', '?'+$.param(sero)+'#'+ns);
  });// .click(function() {
    // TODO
  //     return false;
  //   });

  // total
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
      getcalculatorlink.trigger('update');
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
      getcalculatorlink.trigger('update');
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
    getcalculatorlink.trigger('update');
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

/*** dlv formulas ***/
var dlv_run = function (d,a,c) {
  var fn = function(m) { return Math.floor((d/m-a)/c); }
  fn.inverse = function(pt) { return d/(pt*c+a); }
  return fn;
}
var dlv_jump = function (a,c) {
  var fn = function(m) { return Math.floor((Math.sqrt(m)-a)/c); }
  fn.inverse = function(m) { return Math.pow(m*c+a, 2); }
  return fn;
}
var dlv_throw = dlv_jump;
var dlv_formulas = {
  m: {
      _50m: dlv_run(50, 3.79, 0.0069),
      _75m: dlv_run(75, 4.1, 0.00664),
      _long: dlv_jump(1.15028, 0.00219),
      _high: dlv_jump(0.841, 0.0008),
      _200g: dlv_throw(1.936, 0.0124)
  }
}

/*** iaaf formulas ***/
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
        name: "75m",
        id: "75m",
        disc2pt: dlv_formulas.m._75m,
        pt2disc: dlv_formulas.m._75m.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "Weitsprung",
        id: "weit",
        disc2pt: dlv_formulas.m._long,
        pt2disc: dlv_formulas.m._long.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "200g Schlagball",
        id: "200g",
        disc2pt: dlv_formulas.m._200g,
        pt2disc: dlv_formulas.m._200g.inverse,
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
        name: "75m",
        id: "75m",
        disc2pt: dlv_formulas.m._75m,
        pt2disc: dlv_formulas.m._75m.inverse,
        parsedisc: parseSeconds,
        showdisc: showSeconds,
        unit: "s"
      },
      {
        name: "Weitsprung",
        id: "weit",
        disc2pt: dlv_formulas.m._long,
        pt2disc: dlv_formulas.m._long.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {
        name: "Hochsprung",
        id: "hoch",
        disc2pt: dlv_formulas.m._high,
        pt2disc: dlv_formulas.m._high.inverse,
        parsedisc: parseMeters,
        showdisc: showMeters,
        unit: "m"
      },
      {              
        name: "200g Schlagball",
        id: "200g",
        disc2pt: dlv_formulas.m._200g,
        pt2disc: dlv_formulas.m._200g.inverse,
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
        parsedisc: parseMinutes,
        showdisc: showMinutes,
        unit: "m:s"
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

/*** setup navigation ***/
$('.rechner:not(:first)', '#kirel-mehrkampf-rechner').hide();
var go = function (id) {
  $('.rechner', '#kirel-mehrkampf-rechner').hide();
  $(id, '#kirel-mehrkampf-rechner').show();    
}
$('#kirel-mehrkampf-rechner select.nav').change(function() {
  if ($(this).val()) {
    go($('#'+$(this).val()));
  }
});

// query string as object
var qso = function () {
  var qs = window.location.href.split('?')[1];
  if (qs) {
    return _(qs.split('#')[0].split('&')).reduce({}, function(qso, slice) {
      var pair = slice.split('=');
      qso[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      return qso;
    });
  }
  else {
    return {};
  }
}
// get the hash
var hash = function() {
  return window.location.hash.split('#')[1];
}
// open the right calculator
if (hash()) {
  $('#kirel-mehrkampf-rechner select.nav').val(hash());
  go('#'+hash());
}
// fill fields
jQuery.each(qso(), function (id, val) {
  $('#kirel-mehrkampf-rechner #'+id).val(val).keyup();
})
$('#kirel-mehrkampf-rechner .getcalculatorlink').trigger('update');

})($.noConflict(), _.noConflict());

/*** sneak in ga ***/
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-8668142-4']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();