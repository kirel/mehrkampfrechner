/**
* Nationale Punktetabelle, Ausgabe 1994 des DLV
*
* Sie gilt für die Auswertung aller:
*   Schülermehrkämpfe
*   Blockwettkämpfe
*   Mannschaftsmehrkämpfe einschl. DMM, DJMM, DSMM,
*   DAMM aller Klassen
*/

var showSeconds = function (num) {
  return Math.floor(num * Math.pow(10, 2)) / Math.pow(10, 2);
}

var showMeters = function (num) {
  return Math.ceil(num * Math.pow(10, 2)) / Math.pow(10, 2);
}

var run_val2pt = function (d,a,c) { return function(m) { return (d/m-a)/c; } }
var run_pt2val = function (d,a,c) { return function(m) { return d/(m*c+a); } }
var jump_val2pt = function (a,c) { return function(m) { return (Math.sqrt(m)-a)/c; } }
var jump_pt2val = function (a,c) { return function(m) { return Math.pow(m*c+a, 2); } }
var throw_val2pt = jump_val2pt;
var throw_pt2val = jump_pt2val;

var formulasM = {
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
  "200g_val2pt": throw_val2pt(1.936, 0.0124),
  "200g_pt2val": throw_pt2val(1.936, 0.0124),
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

$.fn.mehrkampfrechner = function(disciplines) {  
  var rechner = this;
    
  // set up the html
  
  var t = ''
  t+= '<table>'
  t+= '<thead><tr><th>Disziplin</th><th>Leistung</th><th>Einheit</th><th>Punkte</th></tr></thead>'
  t+= '<tfoot><tr><td colspan="3">Gesamt</td><td class="total"><input id="total" type="text"/></td></tr></tfoot>'
  t+= '{{#disciplines}}'
  t+= '<tr>'
  t+= '<td class="name">{{name}}</td><td class="discipline"><input id="{{id}}" type="text"/></td><td class="unit">{{unit}}</td>'
  t+= '<td class="pts"><input id="{{id}}pts" type="text"/></td>'
  t+= '</tr>'
  t+= '{{/disciplines}}'
  t+= '</table>'
  var html = $.mustache(t, { "disciplines": disciplines }); 
  
  $(rechner).html(html);
  
  // helper
  var disenable = function () {
    var total = $('#total', rechner);
    // disenable pts/disc
    if (total.isSet() && $('td.pts input.unset').size() == 1) {
      $('td.pts input.unset, td.discipline input.unset').disable();
    }
    else {
      $('td.pts input.unset, td.discipline input.unset').enable();
    }
    // disenable total
    if ($('td.pts input.unset').size() == 0) {
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
    var total = $("#total", rechner);
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
    $('#'+discipline.id, rechner).keyup(function() {
      var val = $(this).val();
      if (val === '') {
        $(this).unset();
      }
      else {
        $(this).set();
      }
      $('#'+discipline.id+'pts', rechner).trigger('update');
      $('#total', rechner).trigger('update');
      fillShareQueue();
      $('td.pts input.unset', rechner).trigger('update');
      $('td.discipline input.unset', rechner).trigger('update');
      disenable();
    });
    // setup pts interaction
    $('#'+discipline.id+'pts', rechner).keyup(function() {
      var val = $(this).val();
      if (val === '') {
        $(this).unset();
      }
      else {
        $(this).set();
      }
      $('#'+discipline.id, rechner).trigger('update');
      $('#total', rechner).trigger('update');
      fillShareQueue();
      $('td.pts input.unset', rechner).trigger('update');
      $('td.discipline input.unset', rechner).trigger('update');
      disenable();
    });    
  });

  $('#total', rechner).keyup(function() {
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
    $('#'+discipline.id, rechner).bind('update', function() {
      var pts = $('#'+discipline.id+'pts', rechner);
      var total = $('#total', rechner);
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
    $('#'+discipline.id+'pts', rechner).bind('update', function() {
      var disc = $('#'+discipline.id, rechner);
      var total = $('#total', rechner);
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
  $('#total', rechner).bind('update', function() {
    if ($('td.pts input.unset').size() == 0) {
      var calculate = function () {
        var totalpts = 0;
        $("td.pts input").each(function(index, pts) {
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
    $('#'+discipline.id, rechner).unset();
    // setup pts interaction
    $('#'+discipline.id+'pts', rechner).unset();
  });
  $('#total', rechner).unset();
  
  
  // update events
      
  /* interaction */
  /*
  total.keyup(function () {
    if (total.val()) {
      total.addClass("set").removeClass("unset setbypts");
    } else {
      total.addClass("unset").removeClass("set setbypts");
    }
    
    // FIXME
    
    var set = 0.0;
    $.each(parts, function(index, val) {
      var pt = $(val.pt);
      if (pt.hasClass('set') || pt.hasClass('setbydisc')) set += val.parsept(pt.val());                  
    });
    var rest = fst.parsetotal(total.val()) - set;
    var fraction = rest / unset.length;
    $.each(parts, function(index, val) {
      var pt = $(val.pt);
      if (pt.hasClass('unset')) pt.addClass("setbytotal").removeClass("set unset setbydisc");
      if (pt.hasClass('setbytotal')) {
        pt.val(val.showpt(fraction));
      }
      $(val.disc).trigger('update');
    });
    total.attr('disabled', '');
    
    // TODO check if only one unset left and disable input on both pt and val
    
  });
  
  // update total and only total
  total.bind('update', function (evt) {
    // check for unset and setbytotal pts
    var pts = $(_(parts).chain().pluck('pt').value().join(', ')).toArray();
    var unset = _(pts).filter(function(pt) { return $(pt).hasClass("unset") || $(pt).hasClass("setbytotal"); })
    // if none of the pts is unset
    if (unset.length == 0) {
      console.log('updating total');
      total.addClass("setbypts").removeClass("set unset");
      var res = 0.0
      $.each(parts, function(index, val) {
        console.log(val.parsept($(val.pt).val()));
        res += val.parsept($(val.pt).val());
      });
      total.val(fst.showtotal(res));
      total.attr('disabled', 'disabled');
    }
    // total is not set manually - clear!
    else if (!total.hasClass("set")) {
      total.addClass("unset").removeClass("setbypts set");
      total.val("");
      total.attr('disabled', '');
    }
    // total is set manually - thus do nothing
  });
      
  $.each(parts, function(index, val) {
    var pt = $(val.pt);
    var disc = $(val.disc);
    pt.addClass("unset");
    disc.addClass("unset");
    
    // pt.change(function (evt) { disc.trigger('update'); });
    // disc.change(function (evt) { pt.trigger('update'); });
    
    pt.keyup(function(evt) {
      if (evt.keyCode == 9) return;
      if (pt.val()) {
        pt.addClass("set").removeClass("unset setbydisc setbytotal");
      } else {
        pt.addClass("unset").removeClass("set setbydisc setbytotal");
      }
      // update disc
      disc.trigger('update');
      total.trigger('update');
    });            
    disc.keyup(function (evt) {
      if (evt.keyCode == 9) return;
      if (disc.val()) {
        disc.addClass("set").removeClass("unset setbypt");
      } else {
        disc.addClass("unset").removeClass("set setbypt");
      }
      // update pt
      pt.trigger('update');
      total.trigger('update');
    });

    // update this field and only this field
    pt.bind('update', function (evt) {
      // get the info from disc
      console.log('updating pt');
      if (disc.val()) {
        pt.addClass("setbydisc").removeClass("set unset setbytotal");
        var compute = _.compose(val.showpt, val.disc2pt, val.parsedisc);
        pt.val(compute(disc.val()));
      } else {
        pt.addClass("unset").removeClass("set setbydisc");
        pt.val("");
      }
    });
    
    // update this field and only this field
    disc.bind('update', function (evt) {
      console.log('updating disc');
      if (pt.val()) {
        disc.addClass("setbypt").removeClass("set unset");
        var compute = _.compose(val.showdisc, val.pt2disc, val.parsept);
        disc.val(compute(pt.val()));
      } else {
        disc.addClass("unset").removeClass("set setbypt");
        disc.val("");
      }
    });
  });
  */
}
