/**
* Nationale Punktetabelle, Ausgabe 1994 des DLV
*
* Sie gilt für die Auswertung aller:
*   Schülermehrkämpfe
*   Blockwettkämpfe
*   Mannschaftsmehrkämpfe einschl. DMM, DJMM, DSMM,
*   DAMM aller Klassen
*/


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

var coderange = function(from, to) { return function(code) { return code >= from && code <= to; } }
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
  t+= '<tfoot><tr><td colspan="3"><label for="{{ns}}-total">Gesamt</label></td><td class="total"><input id="{{ns}}-total" type="text"/></td></tr></tfoot>'
  t+= '{{#disciplines}}'
  t+= '<tr>'
  t+= '<td class="name"><label for="{{ns}}-{{id}}">{{name}}</label></td>'
  t+= '<td class="discipline"><input id="{{ns}}-{{id}}" type="text"/></td><td class="unit">{{unit}}</td>'
  t+= '<td class="pts"><input id="{{ns}}-{{id}}pts" type="text"/></td>'
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
    console.log('currentpts '+currentpts);
    // get goal
    var goalpts = parsept(total.val());
    console.log('goalpts '+goalpts);
    // left
    var leftpts = goalpts - currentpts;
    console.log('leftpts '+leftpts);
    // must be spreaded across
    var num = unset.size();
    console.log('num '+num);
    // fill the sharequeue so that foldl(+, sharequeue) == leftpts
    // initialize
    sharequeue = [];
    for (var i = 0; i < num; i++) {
      sharequeue.push(0);
      console.log('pushing');
    }
    console.log(sharequeue.concat());
    // fill
    var j = 0;
    while (leftpts > 0) {
      sharequeue[j%num]++;
      j++;
      leftpts--;
    }
    console.log(sharequeue.concat());
  }
  
  // setup the interaction
  $.each(disciplines, function(index, discipline) {
    // setup disc interaction
    $('#'+ns+'-'+discipline.id, rechner).keyup(function() {
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
    $('#'+ns+'-'+discipline.id+'pts', rechner).keyup(function() {
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

  total.keyup(function() {
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
      "200g_pt2val": throw_pt2val(1.936, 0.0124),    
  }
}

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
  }
  
]
/* templates */

var template = '<select class="nav">{{#rechner}}<option value="{{id}}">{{name}}</option>{{/rechner}}</select>{{#rechner}}<div id="{{id}}" class="rechner"></div>{{/rechner}}';
var html = $.mustache(template, { rechner: rechner }); 

document.write('<div id="kirel-mehrkampf-rechner"></div>');
$('#kirel-mehrkampf-rechner').html(html);
$.each(rechner, function (i, r) {
  $('#'+r.id).mehrkampfrechner(r.name, r.disciplines);
})

/*** setup navigation ***/
$('.rechner:not(:first)', '#kirel-mehrkampf-rechner').hide();
$('#kirel-mehrkampf-rechner select.nav').change(function () {
  $('.rechner', '#kirel-mehrkampf-rechner').hide();
  $('#'+$(this).val(), '#kirel-mehrkampf-rechner').show();
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

