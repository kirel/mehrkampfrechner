/* Javascript Mehrkampfrechner (c)2010 Daniel Kirsch */
(function($, _) {
  
  _.mixin({
    flip : function(fn) {
      return function(a,b) { return fn(b,a); };
    }
  });

// business logic here
Number.prototype.floor = function (prec) { return Math.floor(this*Math.pow(10,prec))/Math.pow(10,prec); };

var parseSeconds = function (s) {
  return parseFloat(s.replace(',','.')).floor(2);
};

var showSeconds = function (num) {
  return num.floor(2);
};

var parseMinutes = function (s) {
  return _(s.replace(',','.').split(':')).reduce(0.0, function(res, part) {
    return (res * 60) + parseFloat(part);
  });
};

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
};

var parseMeters = function (m) {
  return parseFloat(m.replace(',','.')).floor(2);
};

var showMeters = function (num) {
  return num.floor(2);
};

var coderange = function(from, to) { return function(code) { return (code >= from && code <= to); }; };
var tab = coderange(9, 9);
var atoz = coderange(65, 90);
var digit = coderange(48, 57);
var arrows = coderange(37, 40); // left up right down

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

$.fn.mehrkampfrechner = function(name, disciplines) {  
  var rechner = this;
  var ns = $(this).attr('id');
    
  // set up the html
  
  var t = '';
  t+= '<h2>{{name}}</h2>';
  t+= '<input type="checkbox" id="{{ns}}-penalize" checked="true"><label for="{{ns}}-penalize">elektronische Zeitnahme</label>';
  t+= '<table>';
  t+= '<thead><tr><th>Disziplin</th><th>Leistung</th><th>Einheit</th><th>Punkte</th></tr></thead>';
  t+= '<tfoot><tr><td colspan="3"><label for="{{ns}}-total">Gesamt</label></td><td class="total"><input id="{{ns}}-total" type="text" tabindex="2"/></td></tr></tfoot>';
  t+= '{{#disciplines}}';
  t+= '<tr>';
  t+= '<td class="name"><label for="{{ns}}-{{id}}">{{name}}</label></td>';
  t+= '<td class="discipline"><input id="{{ns}}-{{id}}" type="text" tabindex="1"/></td><td class="unit">{{unit}}</td>';
  t+= '<td class="pts"><input id="{{ns}}-{{id}}pts" type="text" tabindex="3"/></td>';
  t+= '</tr>';
  t+= '{{/disciplines}}';
  t+= '</table>';
  t+= '<small><a class="getcalculatorlink" href="#{{id}}">Link</a> zum Mehrkampf</small>';
  var html = $.mustache(t, { disciplines: disciplines, name: name, ns: ns }); 
  
  $(rechner).html(html);

  /*** link functionality ***/
  
  var URL = 'http://kirelabs.org/mehrkampfrechner/';
  
  var getcalculatorlink = $('.getcalculatorlink', rechner).bind('update', function() {
    var sero = {};
    $('input.set', rechner).each(function (_, el) {
      sero[$(el).attr('id')] = $(el).val();
    });
    if ($.isEmptyObject(sero)) {      
      $(this).attr('href', URL+'#'+ns);
    }
    else {
      $(this).attr('href', URL+'?'+$.param(sero)+'#'+ns);
    }
  });// .click(function() {
    // TODO
  //     return false;
  //   });

  // total
  var total = $('#'+ns+'-total', rechner);
  
  // penalties
  var penalize = function() { return !$('#'+ns+'-penalize', rechner).is(':checked'); };
  $('#'+ns+'-penalize', rechner).change(function () {
    $('input.set', rechner).keyup();
  });
  $.each(disciplines, function(index, discipline) {
    var originalpt2disc = discipline.pt2disc;
    discipline.pt2disc = function (val) {
      if (penalize()) {
        return originalpt2disc(val, true);
      }
      else {
        return originalpt2disc(val);
      }
    };
    var originaldisc2pt = discipline.disc2pt;
    discipline.disc2pt = function (val) {
      if (penalize()) {
        return originaldisc2pt(val, true);
      }
      else {
        return originaldisc2pt(val);
      }
    };
  });
  // helper
  var disenable = function () {
    // disenable pts/disc
    if (total.isSet() && $('td.pts input.unset', rechner).size() === 1) {
      $('td.pts input.unset, td.discipline input.unset', rechner).disable();
    }
    else {
      $('td.pts input.unset, td.discipline input.unset', rechner).enable();
    }
    // disenable total
    if ($('td.pts input.unset', rechner).size() === 0) {
      total.disable();
    }
    else {
      total.enable();
    }
  };
  
  var parsept = parseInt;
  var showpt = function (num) { return Math.floor(num).toString(); };
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
    var i;
    for (i = 0; i < num; i++) {
      sharequeue.push(0);
    }
    // fill
    var j = 0;
    while (leftpts > 0) {
      sharequeue[j%num]++;
      j++;
      leftpts--;
    }
  };
  
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
      var calculate;
      var pts = $('#'+ns+'-'+discipline.id+'pts', rechner);
      if (pts.isSet()) {
        calculate = _.compose(discipline.showdisc, discipline.pt2disc, parsept);
        $(this).calculate(calculate(pts.val()));
      }
      else if (total.isSet()) {
        calculate = _.compose(discipline.showdisc, discipline.pt2disc, parsept);
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
      var calculate;
      var disc = $('#'+ns+'-'+discipline.id, rechner);
      // FIXME do I need if $(this).isSet() ?
      if (disc.isSet()) {
        calculate = _.compose(showpt, discipline.disc2pt, discipline.parsedisc);
        $(this).calculate(calculate(disc.val()));
      }
      else if (total.isSet()) {
        calculate = function() {
          return showpt(sharequeue.pop());
        };
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
    if any pts are set or calculated unless total is set
      update from all pts
    else if total is set
      do nothing
    else
      do nothing
  */
  total.bind('update', function() {
    var calculate;
    var ptsinps = $('td.pts input.set, td.pts input.calculated', rechner);
    if (!$(this).isSet() && ptsinps.size() > 0) {
      calculate = function () {
        var totalpts = 0;
        ptsinps.each(function(index, pts) {
          totalpts += parsept($(pts).val());
        });
        return showpt(totalpts);
      };
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
  
};

/*** dlv formulas ***/
var dlv_run = function (d,a,c,penalty) {
  var fn = function(m, penalize) {
    if (penalize) {
      return Math.floor((d/(m+penalty)-a)/c);      
    }
    else {
      return Math.floor((d/m-a)/c);
    }
  };
  fn.inverse = function(pt, penalize) {
    if (penalize) {
      return d/(pt*c+a)-penalty;
    }
    else {
      return d/(pt*c+a);      
    }
  };
  return fn;
};
var dlv_jump = function (a,c) {
  var fn = function(m) { return Math.floor((Math.sqrt(m)-a)/c); };
  fn.inverse = function(m) { return Math.pow(m*c+a, 2); };
  return fn;
};
var dlv_throw = dlv_jump;
/*** iaaf formulas ***/
var iaaf_run = function (a,b,c,penalty) {
  var fn = function (m, penalize) {
    if (penalize) {
      return Math.floor(a * Math.pow(b-(m+penalty), c));
    }
    else {
      return Math.floor(a * Math.pow(b-m, c));
    }
  };
  fn.inverse = function (pt, penalize) {
    if (penalize) {
      return b - Math.pow(pt/a,1/c) - penalty;
    }
    else {
      return b - Math.pow(pt/a,1/c);
    }
  };
  return fn;
};
var iaaf_throw = function (a,b,c) {
  var fn = function (m) { return Math.floor(a * Math.pow(m-b, c)); };
  fn.inverse = function (pt) { return b + Math.pow(pt/a,1/c); };
  return fn;
};
var iaaf_jump = function (a,b,c) {
  var fn = function (m) { return iaaf_throw(a,b,c)(m*100); };
  fn.inverse = function (m) { return iaaf_throw(a,b,c).inverse(m)/100; };
  return fn;
};
// the formulas
var formulas = {
  iaaf: {
    m: {
      _60m: iaaf_run(58.015, 11.5, 1.81, 0.24),
      _100m: iaaf_run(25.4347, 18, 1.81, 0.24),
      _200m: iaaf_run(5.8425, 38, 1.81, 0.24),
      _300m: iaaf_run(2.58503, 60.1, 1.81, 0.14),
      _400m: iaaf_run(1.53775, 82, 1.81, 0.14),
      _800m: iaaf_run(0.13279, 235, 1.85, 0),
      _1000m: iaaf_run(0.08713, 305.5, 1.85, 0),
      _1500m: iaaf_run(0.03768, 480, 1.85, 0),
      _3000m: iaaf_run(0.0105, 1005, 1.85, 0),
      _5000m: iaaf_run(0.00419, 1680, 1.85, 0),
      _10000m: iaaf_run(0.000415, 4245, 1.9, 0),
      _3000mSt: iaaf_run(0.00511, 1155, 1.9, 0),
      _60mH: iaaf_run(20.5173, 15.5, 1.92, 0.24),
      _110mH: iaaf_run(5.74325, 28.5, 1.92, 0.24),
      _200mH: iaaf_run(3.495, 45.5, 1.81, 0.24),
      _400mH: iaaf_run(1.1466, 92, 1.81, 0.14),
      _high: iaaf_jump(0.8465, 75, 1.42),
      _pole: iaaf_jump(0.2797, 100, 1.35),
      _long: iaaf_jump(0.14354, 220, 1.40),
      _triple: iaaf_jump(0.06533, 640, 1.4),
      _shot: iaaf_throw(51.39, 1.5, 1.05),
      _disc: iaaf_throw(12.91, 4, 1.10),
      _javelin: iaaf_throw(10.14, 7, 1.08),
      _hammer: iaaf_throw(13.0449, 7, 1.05)
    },
    w: {
      _60m: iaaf_run(46.0849, 13, 1.81, 0.24),
      _100m: iaaf_run(17.857, 21, 1.81, 0.24),
      _200m: iaaf_run(4.99087, 42.5, 1.81, 0.24),
      _400m: iaaf_run(1.34285, 91.7, 1.81, 0.14),
      _800m: iaaf_run(0.11193, 254, 1.88, 0),
      _1000m: iaaf_run(0.07068, 337, 1.88, 0),
      _1500m: iaaf_run(0.02883, 535, 1.88, 0),
      _3000m: iaaf_run(0.00683, 1150, 1.88, 0),
      _5000m: iaaf_run(0.00272, 1920, 1.88, 0),
      _10000m: iaaf_run(0.000396, 4920, 1.88, 0),
      _3000mSt: iaaf_run(0.00408, 1320, 1.9, 0),
      _60mH: iaaf_run(20.0479, 17, 1.835, 0.24),
      _100mH: iaaf_run(9.23076, 26.7, 1.835, 0.24),
      _200mH: iaaf_run(2.975, 52, 1.81, 0.24),
      _400mH: iaaf_run(0.99674, 103, 1.81, 0.14),
      _high: iaaf_jump(1.84523, 75, 1.348),
      _pole: iaaf_jump(0.44125, 100, 1.35),
      _long: iaaf_jump(0.188807, 210, 1.41),
      _triple: iaaf_jump(0.08559, 600, 1.41),
      _shot: iaaf_throw(56.0211, 1.5, 1.05),
      _disc: iaaf_throw(12.3311, 3, 1.10),
      _javelin: iaaf_throw(15.9803, 3.8, 1.04),
      _hammer: iaaf_throw(17.5458, 6, 1.05)    
    }
  },
  dlv: {
    m: {
      _50m: dlv_run(50, 3.79, 0.0069, 0.24),
      _60m: dlv_run(60, 4.20312, 0.00639, 0.24),
      _75m: dlv_run(75, 4.1, 0.00664, 0.24),
      _100m: dlv_run(100, 4.34100, 0.00676, 0.24),
      _200m: dlv_run(200, 3.60400, 0.00760 , 0.24),
      _400m: dlv_run(400, 2.967, 0.00716, 0.14),
      _800m: dlv_run(800, 2.32500, 0.00644, 0),
      _1000m: dlv_run(1000, 2.15800, 0.00600, 0),
      _1500m: dlv_run(1500, 1.91220, 0.00613, 0),
      _2000m: dlv_run(2000, 1.78400, 0.00600, 0),
      _3000m: dlv_run(3000, 1.70000, 0.00580, 0),
      _5000m: dlv_run(5000, 1.52500, 0.00560, 0),
      _60mH: dlv_run(60, 3.04000, 0.00560, 0.24),
      _80mH: dlv_run(80, 1.40833, 0.00943, 0.24),
      _110mH: dlv_run(110, 1.14220, 0.00918, 0.24),
      _400mH: dlv_run(400, 1.61943, 0.00810, 0.14),
      _4x50m: dlv_run(200, 3.79000, 0.00345, 0.24),
      _4x75m: dlv_run(300, 4.10000, 0.00332, 0.14),
      _4x100m: dlv_run(400, 4.34100, 0.00338, 0.14),
      _high: dlv_jump(0.841, 0.0008),
      _pole: dlv_jump(0.64800, 0.00210),
      _long: dlv_jump(1.15028, 0.00219),
      _triple: dlv_jump(2.19239, 0.00232),
      _shot: dlv_throw(1.42500, 0.00370),
      _disc: dlv_throw(1.40000, 0.00800),
      _hammer: dlv_throw(-2.17028, 0.01392),
      _javelin: dlv_throw(0.35000, 0.01052),
      _200g: dlv_throw(1.936, 0.0124),
      _80g: dlv_throw(2.80000, 0.01100)
    },
    w: {
      _50m: dlv_run(50, 3.64800, 0.00660, 0.24),
      _60m: dlv_run(60, 3.65071, 0.00673, 0.24),
      _75m: dlv_run(75, 3.99800, 0.00660, 0.24),
      _100m: dlv_run(100, 4.00620, 0.00656, 0.24),
      _200m: dlv_run(200, 3.78900, 0.00734, 0.24),
      _400m: dlv_run(400, 2.81000, 0.00716, 0.14),
      _800m: dlv_run(800, 2.02320, 0.00647, 0),
      _2000m: dlv_run(2000, 1.80000, 0.00540, 0),
      _3000m: dlv_run(3000, 1.75000, 0.00500, 0),
      _60mH: dlv_run(60, 2.12020, 0.00680, 0.24),
      _80mH: dlv_run(80, 2.01000, 0.00780, 0.24),
      _100mH: dlv_run(100, 2.01500, 0.00810, 0.24),
      _4x50m: dlv_run(200, 3.64800, 0.00330, 0.24),
      _4x75m: dlv_run(300, 3.99800, 0.00330, 0.14),
      _4x100m: dlv_run(400, 4.00620, 0.00328, 0.14),
      _high: dlv_jump(0.88070, 0.00068),
      _long: dlv_jump(1.09350, 0.00208),
      _shot: dlv_throw(1.27900, 0.00398),
      _disc: dlv_throw(1.05150, 0.00890),
      _javelin: dlv_throw(0.42200, 0.01012),
      _200g: dlv_throw(1.41490, 0.01039),
      _80g: dlv_throw(2.02320, 0.00874)
    }
  }  
};

var disciplines = {};
disciplines.iaaf = {};
disciplines.iaaf.m = {
  _60m: {
    name: "60m",
    id: "60m",
    disc2pt: formulas.iaaf.m._60m,
    pt2disc: formulas.iaaf.m._60m.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _100m: {
    name: "100m",
    id: "100m",
    disc2pt: formulas.iaaf.m._100m,
    pt2disc: formulas.iaaf.m._100m.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _200m: {
    name: "200m",
    id: "200m",
    disc2pt: formulas.iaaf.m._200m,
    pt2disc: formulas.iaaf.m._200m.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _300m: {
    name: "300m",
    id: "300m",
    disc2pt: formulas.iaaf.m._300m,
    pt2disc: formulas.iaaf.m._300m.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _400m: {
    name: "400m",
    id: "400m",
    disc2pt: formulas.iaaf.m._400m,
    pt2disc: formulas.iaaf.m._400m.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _800m: {
    name: "800m",
    id: "800m",
    disc2pt: formulas.iaaf.m._800m,
    pt2disc: formulas.iaaf.m._800m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _1000m: {
    name: "1000m",
    id: "1000m",
    disc2pt: formulas.iaaf.m._1000m,
    pt2disc: formulas.iaaf.m._1000m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _1500m: {
    name: "1500m",
    id: "1500m",
    disc2pt: formulas.iaaf.m._1500m,
    pt2disc: formulas.iaaf.m._1500m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _3000m: {
    name: "3000m",
    id: "3000m",
    disc2pt: formulas.iaaf.m._3000m,
    pt2disc: formulas.iaaf.m._3000m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _5000m: {
    name: "5000m",
    id: "5000m",
    disc2pt: formulas.iaaf.m._5000m,
    pt2disc: formulas.iaaf.m._5000m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _10000m: {
    name: "10000m",
    id: "10000m",
    disc2pt: formulas.iaaf.m._10000m,
    pt2disc: formulas.iaaf.m._10000m.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _3000mSt: {
    name: "3000m Hindernis",
    id: "3000mSt",
    disc2pt: formulas.iaaf.m._3000mSt,
    pt2disc: formulas.iaaf.m._3000mSt.inverse,
    parsedisc: parseMinutes,
    showdisc: showMinutes,
    unit: "min"
  },
  _60mH: {
    name: "60m Hürden",
    id: "60mH",
    disc2pt: formulas.iaaf.m._60mH,
    pt2disc: formulas.iaaf.m._60mH.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _110mH: {
    name: "110m Hürden",
    id: "110mH",
    disc2pt: formulas.iaaf.m._110mH,
    pt2disc: formulas.iaaf.m._110mH.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _200mH: {
    name: "200m Hürden",
    id: "200mH",
    disc2pt: formulas.iaaf.m._200mH,
    pt2disc: formulas.iaaf.m._200mH.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _400mH: {
    name: "400m Hürden",
    id: "400mH",
    disc2pt: formulas.iaaf.m._400mH,
    pt2disc: formulas.iaaf.m._400mH.inverse,
    parsedisc: parseSeconds,
    showdisc: showSeconds,
    unit: "s"
  },
  _high: {
    name: "Hochsprung",
    id: "high",
    disc2pt: formulas.iaaf.m._high,
    pt2disc: formulas.iaaf.m._high.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _pole: {
    name: "Stabhoch",
    id: "pole",
    disc2pt: formulas.iaaf.m._pole,
    pt2disc: formulas.iaaf.m._pole.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _long: {
    name: "Weitsprung",
    id: "long",
    disc2pt: formulas.iaaf.m._long,
    pt2disc: formulas.iaaf.m._long.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _triple: {
    name: "Dreisprung",
    id: "triple",
    disc2pt: formulas.iaaf.m._triple,
    pt2disc: formulas.iaaf.m._triple.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _shot: {
    name: "Kugel",
    id: "shot",
    disc2pt: formulas.iaaf.m._shot,
    pt2disc: formulas.iaaf.m._shot.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _disc: {
    name: "Diskus",
    id: "disc",
    disc2pt: formulas.iaaf.m._disc,
    pt2disc: formulas.iaaf.m._disc.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _javelin: {
    name: "Speer",
    id: "javelin",
    disc2pt: formulas.iaaf.m._javelin,
    pt2disc: formulas.iaaf.m._javelin.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  },
  _hammer: {
    name: "Hammer",
    id: "hammer",
    disc2pt: formulas.iaaf.m._hammer,
    pt2disc: formulas.iaaf.m._hammer.inverse,
    parsedisc: parseMeters,
    showdisc: showMeters,
    unit: "m"
  }
};

disciplines.iaaf.w = {
  _60m: _.extend({},disciplines.iaaf.m._60m, { disc2pt: formulas.iaaf.w._60m, pt2disc: formulas.iaaf.w._60m.inverse }),
  _100m: _.extend({},disciplines.iaaf.m._100m, { disc2pt: formulas.iaaf.w._100m, pt2disc: formulas.iaaf.w._100m.inverse }),
  _200m: _.extend({},disciplines.iaaf.m._200m, { disc2pt: formulas.iaaf.w._200m, pt2disc: formulas.iaaf.w._200m.inverse }),
  _400m: _.extend({},disciplines.iaaf.m._400m, { disc2pt: formulas.iaaf.w._400m, pt2disc: formulas.iaaf.w._400m.inverse }),
  _800m: _.extend({},disciplines.iaaf.m._800m, { disc2pt: formulas.iaaf.w._800m, pt2disc: formulas.iaaf.w._800m.inverse }),
  _1000m: _.extend({},disciplines.iaaf.m._1000m, { disc2pt: formulas.iaaf.w._1000m, pt2disc: formulas.iaaf.w._1000m.inverse }),
  _1500m: _.extend({},disciplines.iaaf.m._1500m, { disc2pt: formulas.iaaf.w._1500m, pt2disc: formulas.iaaf.w._1500m.inverse }),
  _3000m: _.extend({},disciplines.iaaf.m._3000m, { disc2pt: formulas.iaaf.w._3000m, pt2disc: formulas.iaaf.w._3000m.inverse }),
  _5000m: _.extend({},disciplines.iaaf.m._5000m, { disc2pt: formulas.iaaf.w._5000m, pt2disc: formulas.iaaf.w._5000m.inverse }),
  _10000m: _.extend({},disciplines.iaaf.m._10000m, { disc2pt: formulas.iaaf.w._10000m, pt2disc: formulas.iaaf.w._10000m.inverse }),
  _3000mSt: _.extend({},disciplines.iaaf.m._3000mSt, { disc2pt: formulas.iaaf.w._3000mSt, pt2disc: formulas.iaaf.w._3000mSt.inverse }),
  _60mH: _.extend({},disciplines.iaaf.m._60mH, { disc2pt: formulas.iaaf.w._60mH, pt2disc: formulas.iaaf.w._60mH.inverse }),
  _100mH: _.extend({},disciplines.iaaf.m._110mH, {
    name: "100m Hürden",
    id: "100mH",
    disc2pt: formulas.iaaf.w._100mH,
    pt2disc: formulas.iaaf.w._100mH.inverse
  }),
  _200mH: _.extend({},disciplines.iaaf.m._200mH, { disc2pt: formulas.iaaf.w._200mH, pt2disc: formulas.iaaf.w._200mH.inverse }),
  _400mH: _.extend({},disciplines.iaaf.m._400mH, { disc2pt: formulas.iaaf.w._400mH, pt2disc: formulas.iaaf.w._400mH.inverse }),
  _high: _.extend({},disciplines.iaaf.m._high, { disc2pt: formulas.iaaf.w._high, pt2disc: formulas.iaaf.w._high.inverse }),
  _pole: _.extend({},disciplines.iaaf.m._pole, { disc2pt: formulas.iaaf.w._pole, pt2disc: formulas.iaaf.w._pole.inverse }),
  _long: _.extend({},disciplines.iaaf.m._long, { disc2pt: formulas.iaaf.w._long, pt2disc: formulas.iaaf.w._long.inverse }),
  _triple: _.extend({},disciplines.iaaf.m._triple, { disc2pt: formulas.iaaf.w._triple, pt2disc: formulas.iaaf.w._triple.inverse }),
  _shot: _.extend({},disciplines.iaaf.m._shot, { disc2pt: formulas.iaaf.w._shot, pt2disc: formulas.iaaf.w._shot.inverse }),
  _disc: _.extend({},disciplines.iaaf.m._disc, { disc2pt: formulas.iaaf.w._disc, pt2disc: formulas.iaaf.w._disc.inverse }),
  _javelin: _.extend({},disciplines.iaaf.m._javelin, { disc2pt: formulas.iaaf.w._javelin, pt2disc: formulas.iaaf.w._javelin.inverse }),
  _hammer: _.extend({},disciplines.iaaf.m._hammer, { disc2pt: formulas.iaaf.w._hammer, pt2disc: formulas.iaaf.w._hammer.inverse })    
};

disciplines.dlv = {};
disciplines.dlv.m = {
  _50m: _.extend({},disciplines.iaaf.m._60m, {
    name: "50m",
    id: "50m",
    disc2pt: formulas.dlv.m._50m,
    pt2disc: formulas.dlv.m._50m.inverse
  }),
  _60m: _.extend({},disciplines.iaaf.m._60m, { disc2pt: formulas.dlv.m._60m, pt2disc: formulas.dlv.m._60m.inverse }),
  _75m: _.extend({},disciplines.iaaf.m._60m, {
    name: "75m",
    id: "75m",
    disc2pt: formulas.dlv.m._75m,
    pt2disc: formulas.dlv.m._75m.inverse
  }),
  _100m: _.extend({},disciplines.iaaf.m._100m, { disc2pt: formulas.dlv.m._100m, pt2disc: formulas.dlv.m._100m.inverse }),
  _200m: _.extend({},disciplines.iaaf.m._200m, { disc2pt: formulas.dlv.m._200m, pt2disc: formulas.dlv.m._200m.inverse }),
  _400m: _.extend({},disciplines.iaaf.m._400m, { disc2pt: formulas.dlv.m._400m, pt2disc: formulas.dlv.m._400m.inverse }),
  _800m: _.extend({},disciplines.iaaf.m._800m, { disc2pt: formulas.dlv.m._800m, pt2disc: formulas.dlv.m._800m.inverse }),
  _1000m: _.extend({},disciplines.iaaf.m._1000m, { disc2pt: formulas.dlv.m._1000m, pt2disc: formulas.dlv.m._1000m.inverse }),
  _1500m: _.extend({},disciplines.iaaf.m._1500m, { disc2pt: formulas.dlv.m._1500m, pt2disc: formulas.dlv.m._1500m.inverse }),
  _2000m: _.extend({},disciplines.iaaf.m._1500m, {
    name: "2000m",
    id: "2000m",
    disc2pt: formulas.dlv.m._2000m,
    pt2disc: formulas.dlv.m._2000m.inverse
  }),
  _3000m: _.extend({},disciplines.iaaf.m._3000m, { disc2pt: formulas.dlv.m._3000m, pt2disc: formulas.dlv.m._3000m.inverse }),
  _5000m: _.extend({},disciplines.iaaf.m._5000m, { disc2pt: formulas.dlv.m._5000m, pt2disc: formulas.dlv.m._5000m.inverse }),
  _60mH: _.extend({},disciplines.iaaf.m._60mH, { disc2pt: formulas.dlv.m._60mH, pt2disc: formulas.dlv.m._60mH.inverse }),
  _80mH: _.extend({},disciplines.iaaf.m._60mH, {
    name: "80m Hürden",
    id: "80mH",
    disc2pt: formulas.dlv.m._80mH,
    pt2disc: formulas.dlv.m._80mH.inverse
  }),
  _110mH: _.extend({},disciplines.iaaf.m._110mH, { disc2pt: formulas.dlv.m._110mH, pt2disc: formulas.dlv.m._110mH.inverse }),
  _400mH: _.extend({},disciplines.iaaf.m._400mH, { disc2pt: formulas.dlv.m._400mH, pt2disc: formulas.dlv.m._400mH.inverse }),
  _4x50m: _.extend({},disciplines.iaaf.m._60m, {
    name: "4x50m Staffel",
    id: "4x50m",
    disc2pt: formulas.dlv.m._4x50m,
    pt2disc: formulas.dlv.m._4x50m.inverse
  }),
  _4x75m: _.extend({},disciplines.iaaf.m._60m, {
    name: "4x75m Staffel",
    id: "4x75m",
    disc2pt: formulas.dlv.m._4x75m,
    pt2disc: formulas.dlv.m._4x75m.inverse
  }),
  _4x100m: _.extend({},disciplines.iaaf.m._60m, {
    name: "4x100m Staffel",
    id: "4x100m",
    disc2pt: formulas.dlv.m._4x100m,
    pt2disc: formulas.dlv.m._4x100m.inverse
  }),
  _high: _.extend({},disciplines.iaaf.m._high, { disc2pt: formulas.dlv.m._high, pt2disc: formulas.dlv.m._high.inverse }),
  _pole: _.extend({},disciplines.iaaf.m._pole, { disc2pt: formulas.dlv.m._pole, pt2disc: formulas.dlv.m._pole.inverse }),
  _long: _.extend({},disciplines.iaaf.m._long, { disc2pt: formulas.dlv.m._long, pt2disc: formulas.dlv.m._long.inverse }),
  _triple: _.extend({},disciplines.iaaf.m._triple, { disc2pt: formulas.dlv.m._triple, pt2disc: formulas.dlv.m._triple.inverse }),
  _shot: _.extend({},disciplines.iaaf.m._shot, { disc2pt: formulas.dlv.m._shot, pt2disc: formulas.dlv.m._shot.inverse }),
  _disc: _.extend({},disciplines.iaaf.m._disc, { disc2pt: formulas.dlv.m._disc, pt2disc: formulas.dlv.m._disc.inverse }),
  _hammer: _.extend({},disciplines.iaaf.m._hammer, { disc2pt: formulas.dlv.m._hammer, pt2disc: formulas.dlv.m._hammer.inverse }),
  _javelin: _.extend({},disciplines.iaaf.m._javelin, { disc2pt: formulas.dlv.m._javelin, pt2disc: formulas.dlv.m._javelin.inverse }),
  _200g: _.extend({},disciplines.iaaf.m._javelin, {
    name: "200g Schlagball",
    id: "200g",
    disc2pt: formulas.dlv.m._200g,
    pt2disc: formulas.dlv.m._200g.inverse
  }),
  _80g: _.extend({},disciplines.iaaf.m._javelin, {
    name: "80g Schlagball",
    id: "80g",
    disc2pt: formulas.dlv.m._80g,
    pt2disc: formulas.dlv.m._80g.inverse
  })
};
disciplines.dlv.w = {
  _50m: _.extend({},disciplines.dlv.m._50m, { disc2pt: formulas.dlv.w._50m, pt2disc: formulas.dlv.w._50m.inverse }),
  _60m: _.extend({},disciplines.dlv.m._60m, { disc2pt: formulas.dlv.w._60m, pt2disc: formulas.dlv.w._60m.inverse }),
  _75m: _.extend({},disciplines.dlv.m._75m, { disc2pt: formulas.dlv.w._75m, pt2disc: formulas.dlv.w._75m.inverse }),
  _100m: _.extend({},disciplines.dlv.m._100m, { disc2pt: formulas.dlv.w._100m, pt2disc: formulas.dlv.w._100m.inverse }),
  _200m: _.extend({},disciplines.dlv.m._200m, { disc2pt: formulas.dlv.w._200m, pt2disc: formulas.dlv.w._200m.inverse }),
  _400m: _.extend({},disciplines.dlv.m._400m, { disc2pt: formulas.dlv.w._400m, pt2disc: formulas.dlv.w._400m.inverse }),
  _800m: _.extend({},disciplines.dlv.m._800m, { disc2pt: formulas.dlv.w._800m, pt2disc: formulas.dlv.w._800m.inverse }),
  _2000m: _.extend({},disciplines.dlv.m._2000m, { disc2pt: formulas.dlv.w._2000m, pt2disc: formulas.dlv.w._2000m.inverse }),
  _3000m: _.extend({},disciplines.dlv.m._3000m, { disc2pt: formulas.dlv.w._3000m, pt2disc: formulas.dlv.w._3000m.inverse }),
  _60mH: _.extend({},disciplines.dlv.m._60mH, { disc2pt: formulas.dlv.w._60mH, pt2disc: formulas.dlv.w._60mH.inverse }),
  _80mH: _.extend({},disciplines.dlv.m._80mH, { disc2pt: formulas.dlv.w._80mH, pt2disc: formulas.dlv.w._80mH.inverse }),
  _100mH: _.extend({},disciplines.dlv.m._110mH, {
    name: "100m Hürden",
    id: "100mH",
    disc2pt: formulas.dlv.w._100mH,
    pt2disc: formulas.dlv.w._100mH.inverse
  }),
  _4x50m: _.extend({},disciplines.dlv.m._4x50m, { disc2pt: formulas.dlv.w._4x50m, pt2disc: formulas.dlv.w._4x50m.inverse }),
  _4x75m: _.extend({},disciplines.dlv.m._4x75m, { disc2pt: formulas.dlv.w._4x75m, pt2disc: formulas.dlv.w._4x75m.inverse }),
  _4x100m: _.extend({},disciplines.dlv.m._4x100m, { disc2pt: formulas.dlv.w._4x100m, pt2disc: formulas.dlv.w._4x100m.inverse }),
  _high: _.extend({},disciplines.dlv.m._high, { disc2pt: formulas.dlv.w._high, pt2disc: formulas.dlv.w._high.inverse }),
  _long: _.extend({},disciplines.dlv.m._long, { disc2pt: formulas.dlv.w._long, pt2disc: formulas.dlv.w._long.inverse }),
  _shot: _.extend({},disciplines.dlv.m._shot, { disc2pt: formulas.dlv.w._shot, pt2disc: formulas.dlv.w._shot.inverse }),
  _disc: _.extend({},disciplines.dlv.m._disc, { disc2pt: formulas.dlv.w._disc, pt2disc: formulas.dlv.w._disc.inverse }),
  _javelin: _.extend({},disciplines.dlv.m._javelin, { disc2pt: formulas.dlv.w._javelin, pt2disc: formulas.dlv.w._javelin.inverse }),
  _200g: _.extend({},disciplines.dlv.m._200g, { disc2pt: formulas.dlv.w._200g, pt2disc: formulas.dlv.w._200g.inverse }),
  _80g: _.extend({},disciplines.dlv.m._80g, { disc2pt: formulas.dlv.w._80g, pt2disc: formulas.dlv.w._80g.inverse })
};

_.mixin({ from: function(list, obj) { return _(list).map(function (disc) { return obj['_'+disc]; }); } });

var rechner = [
  {
    name: "Dreikampf SC/D",
    id: "dscd",
    disciplines: _(['50m', 'long', '80g']).from(disciplines.dlv.m)
  },
  {
    name: "Dreikampf SiC/D",
    id: "dsicd",
    disciplines: _(['50m', 'long', '80g']).from(disciplines.dlv.w)
  },
  {
    name: "Dreikampf SB",
    id: "dsb",
    disciplines: _(['75m', 'long', '200g']).from(disciplines.dlv.m)
  },
  {
    name: "Dreikampf SiB",
    id: "dsib",
    disciplines: _(['75m', 'long', '200g']).from(disciplines.dlv.w)
  },
  {
    name: "Dreikampf SA",
    id: "dsa",
    disciplines: _(['100m', 'long', '200g']).from(disciplines.dlv.m)
  },
  {
    name: "Dreikampf SiA",
    id: "dsia",
    disciplines: _(['100m', 'long', '200g']).from(disciplines.dlv.w)
  },
  {
    name: "Vierkampf SC",
    id: "vsc",
    disciplines: _(['50m', 'high', 'long', '80g']).from(disciplines.dlv.m)
  },
  {
    name: "Vierkampf SiC",
    id: "vsic",
    disciplines: _(['50m', 'high', 'long', '80g']).from(disciplines.dlv.w)
  },
  {
    name: "Vierkampf SB",
    id: "vsb",
    disciplines: _(['75m', 'high', 'long', '200g']).from(disciplines.dlv.m)
  },
  {
    name: "Vierkampf SiB",
    id: "vsib",
    disciplines: _(['75m', 'high', 'long', '200g']).from(disciplines.dlv.w)
  },
  {
    name: "Vierkampf SA",
    id: "vsa",
    disciplines: _(['100m', 'high', 'long', 'shot']).from(disciplines.dlv.m)
  },
  {
    name: "Vierkampf SiA",
    id: "vsia",
    disciplines: _(['100m', 'high', 'long', 'shot']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Basis mU14",
    id: "bspsb",
    disciplines: _(['75m', '60mH', 'long', '200g', '2000m']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Sprint SB",
    id: "bspsb",
    disciplines: _(['75m', '60mH', 'high', 'long', '200g']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Sprint SiB",
    id: "bspsia",
    disciplines: _(['75m', '60mH', 'high', 'long', '200g']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Lauf SB",
    id: "blsb",
    disciplines: _(['75m', '60mH', 'long', '200g', '1000m']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Lauf SiB",
    id: "blsib",
    disciplines: _(['75m', '60mH', 'long', '200g', '800m']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Wurf SB",
    id: "blwsb",
    disciplines: _(['75m', '60mH', 'long', 'shot', 'disc']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Wurf SiB",
    id: "blwsib",
    disciplines: _(['75m', '60mH', 'long', 'shot', 'disc']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Sprint SA",
    id: "bspsa",
    disciplines: _(['100m', '80mH', 'high', 'long', 'javelin']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Sprint SiA",
    id: "bspsia",
    disciplines: _(['100m', '80mH', 'high', 'long', 'javelin']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Lauf SA",
    id: "blsa",
    disciplines: _(['100m', '80mH', 'long', '200g', '2000m']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Lauf SiA",
    id: "blsia",
    disciplines: _(['100m', '80mH', 'long', '200g', '2000m']).from(disciplines.dlv.w)
  },
  {
    name: "Blockwettkampf Wurf SA",
    id: "blwsa",
    disciplines: _(['100m', '80mH', 'long', 'shot', 'disc']).from(disciplines.dlv.m)
  },
  {
    name: "Blockwettkampf Wurf SiA",
    id: "blwsia",
    disciplines: _(['100m', '80mH', 'long', 'shot', 'disc']).from(disciplines.dlv.w)
  },
  {
    name: "Achtkampf SA",
    id: "aksa",
    disciplines: _(['80mH', 'long', 'shot', 'high', 'disc', 'pole', 'javelin', '1000m']).from(disciplines.dlv.m)
  },
  {
    name: "Siebenkampf SiA",
    id: "sksia",
    disciplines: _(['80mH', 'high', 'shot', '100m', 'long', 'javelin', '800m']).from(disciplines.dlv.w)
  },
  {
    name: "Fünfkampf MJ",
    id: "fkmj",
    disciplines: _(['100m', 'long', 'shot', 'high', '400m']).from(disciplines.iaaf.m)
  },
  {
    name: "Fünfkampf M",
    id: "fkm",
    disciplines: _(['long', 'javelin', '200m', 'disc', "1500m"]).from(disciplines.iaaf.m)
  },
  {
    name: "Fünfkampf F",
    id: "fkf",
    disciplines: _(['100m', 'high', 'shot', 'long', "800m"]).from(disciplines.iaaf.w)
  },
  {
    name: "Zehnkampf M/MJ",
    id: "zk",
    disciplines: _(['100m', 'long', 'shot', 'high', '400m', '110mH', 'disc', 'pole', 'javelin', '1500m']).from(disciplines.iaaf.m)
  },
  {
    name: "Siebenkampf M/MJ (Halle)",
    id: "skmmj",
    disciplines: _(['60m', 'long', 'shot', 'high', '60mH', 'pole', '1000m']).from(disciplines.iaaf.m)
  },
  {
    name: "Vierkampf WJB",
    id: "vkwjb",
    disciplines: _(['100mH', 'high', 'shot', '100m']).from(disciplines.iaaf.w)
  },
  {
    name: "Vierkampf F/WJA",
    id: "vkfwja",
    disciplines: _(['100mH', 'high', 'shot', '200m']).from(disciplines.iaaf.w)
  },
  {
    name: "Siebenkampf WJB",
    id: "skfwjb",
    disciplines: _(['100mH', 'high', 'shot', '100m', 'long', 'javelin', '800m']).from(disciplines.iaaf.w)
  },
  {
    name: "Siebenkampf F/WJA",
    id: "skfwja",
    disciplines: _(['100mH', 'high', 'shot', '200m', 'long', 'javelin', '800m']).from(disciplines.iaaf.w)
  },
  {
    name: "Fünfkampf F/WJA (Halle)",
    id: "fkfwja",
    disciplines: _(['60mH', 'high', 'shot', 'long', '800m']).from(disciplines.iaaf.w)
  }
  // TODO Wurf-Fünfkampf
];
/* templates */

var template = '\
<select class="nav" tabindex="1">{{#rechner}}\
<option value="{{id}}">{{name}}</option>{{/rechner}}\
<option value="">Weitere Mehrkämpfe folgen...</option>\
</select>{{#rechner}}\
<div id="{{id}}" class="rechner"></div>{{/rechner}}';
var html = $.mustache(template, { rechner: rechner }); 

/*jshint evil:true */
document.write('<div id="kirel-mehrkampf-rechner"></div>');
$('#kirel-mehrkampf-rechner').html(html);
$.each(rechner, function (i, r) {
  $('#'+r.id).mehrkampfrechner(r.name, r.disciplines);
});

var backlink = '<small><a id="kirel-mehrkampfrechner" href="http://kirelabs.org/mehrkampfrechner">Mehrkampfrechner</a> &copy;2010 Daniel Kirsch</small>';
// check for backlink when dom ready
$(function () {
  if ($('a[href|=http://kirelabs.org/mehrkampfrechner]').size() < 1) {
    // add backlink
    $('#kirel-mehrkampf-rechner').append(backlink);
  }
});

/*** adding style ***/
s = '\
<style>\
  #kirel-mehrkampf-rechner {\
    font-size: 16px;\
    font-family: Verdana, sans-serif;\
  }\
  #kirel-mehrkampf-rechner td {\
    padding: 1px 2px;\
  }\
  #kirel-mehrkampf-rechner input[type=text] {\
    -moz-border-radius: 3px;\
    -webkit-border-radius: 3px;\
    border-radius: 3px;\
    border: solid #aaa 1px;\
    padding: 3px;\
  }\
  #kirel-mehrkampf-rechner input.set {\
    color: black;\
  }\
  #kirel-mehrkampf-rechner input.calculated {\
    color: green;\
  }\
  #kirel-mehrkampf-rechner input.unset {\
    color: gray;\
  }\
  #kirel-mehrkampf-rechner td.discipline input {\
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
};
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
};
// get the hash
var hash = function() {
  return window.location.hash.split('#')[1];
};
// open the right calculator
if (hash()) {
  $('#kirel-mehrkampf-rechner select.nav').val(hash());
  go('#'+hash());
}
// fill fields
jQuery.each(qso(), function (id, val) {
  $('#kirel-mehrkampf-rechner #'+id).val(val).keyup();
});
$('#kirel-mehrkampf-rechner .getcalculatorlink').trigger('update');

}(jQuery.noConflict(), _.noConflict()));
