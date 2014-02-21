requirejs.config({
  paths : {
    'src' : '../i/js/modernizr-git/src'
  }
});
// avoid some config
define('underscore', function () { return _; });

require(['src/generate'], function( generate ) {

  function minify( UglifyJS, code, options) {
    options = UglifyJS.defaults(options, {
      outSourceMap : null,
      sourceRoot   : null,
      inSourceMap  : null,
      fromString   : false,
      warnings     : false
    });
    if (typeof files == "string") {
      files = [ files ];
    }

    // 1. parse
    var toplevel = UglifyJS.parse(code, {
      filename: 'modernizr-custombuild.min.js',
      toplevel: toplevel
    });

    // 2. compress
    toplevel.figure_out_scope();
    var sq = UglifyJS.Compressor({
      warnings: options.warnings,
      hoist_vars: true
    });
    toplevel = toplevel.transform(sq);

    // 3. mangle
    toplevel.figure_out_scope();
    toplevel.compute_char_frequency();
    toplevel.mangle_names({except: ['Modernizr']});

    // 4. output
    var stream = UglifyJS.OutputStream({});
    toplevel.print(stream);
    return stream.toString();
  }

  function generateBuildHash(config) {
    var buildHash = '#-' + _(config.properties).map(function(propName) {
        return propName.replace('-', '');
      }).join('-') + ( config.classPrefix ? '-cssclassprefix:' + config.classPrefix.replace(/\-/g, '!') : '' );

    return buildHash;
  }

  // Check for preselections
  function loadFromHash() {
    var hash = window.location.hash;
    if ( hash.length > 1 ) {
      hash = hash.substr(1);
      var selections = hash.split('-');

      // Unselect everything
      $('input[type="checkbox"]').removeAttr('checked');
      for(var i in selections) {
        if ( selections[i].match( /cssclassprefix/ ) ) {
          var cssclassprefix = selections[i].substr(15).replace(/\!/g,'-');
          $('#cssprefix').val(cssclassprefix);
        }
        else if (selections[i] == 'dontmin'){
          $('#dontmin').attr('checked', 'checked');
        }
        else {
          $('input[value=' + selections[i] + ']').attr('checked', 'checked');
        }
      }
      var checked = $('#cssclasses input:checkbox').is(':checked');
      $('#cssprefixcontainer').toggle(checked);

      build();
    }
  }

  function getBuildConfig() {
    var $featureCheckboxes = $('#fd-list input:checked');
    // A list of the property names, e.g. `['flexbox', …]`
    var properties = $.makeArray($('#fd-list input:checked').map(function() {
      return this.value;
    }));
    // A list of the corresponding AMD paths, e.g. `['test/css/flexbox', …]`
    var amdPaths = $.makeArray($featureCheckboxes.map(function() {
      return this.getAttribute('data-amd-path');
    }));
    // Additional options
    var options = $.makeArray($('#options-list input:checked').map(function() {
      return this.value;
    }));
    var classPrefix = $('#cssprefix').val();
    var config = {
      'classPrefix': classPrefix,
      'properties': properties, // Not used by builder; we need it though
      'feature-detects': amdPaths,
      'options': options
    };

    return config;
  }

  // Handle a build
  function build() {

    var config = getBuildConfig();
    var modInit = generate(config);

    requirejs.optimize({
      "baseUrl" : "../i/js/modernizr-git/src/",
      "optimize"    : "none",
      "optimizeCss" : "none",
      "paths" : {
        "test" : "../../../../feature-detects"
      },
      "include" : ["modernizr-init"],
      wrap: {
        start: ";(function(window, document, undefined){",
        end: "})(this, document);"
      },
      rawText: {
        'modernizr-init' : modInit
      },
      onBuildWrite: function (id, path, contents) {
        if ((/define\(.*?\{/).test(contents)) {
          //Remove AMD ceremony for use without require.js or almond.js
          contents = contents.replace(/define\(.*?\{/, '');

          contents = contents.replace(/\}\);\s*?$/,'');

          if ( !contents.match(/Modernizr\.addTest\(/) && !contents.match(/Modernizr\.addAsyncTest\(/) ) {
            //remove last return statement and trailing })
            contents = contents.replace(/return.*[^return]*$/,'');
          }
        }
        else if ((/require\([^\{]*?\{/).test(contents)) {
          contents = contents.replace(/require[^\{]+\{/, '');
          contents = contents.replace(/\}\);\s*$/,'');
        }
        return contents;
      },
      out : function (output) {
        output = output.replace('define("modernizr-init", function(){});', '');
        // Hack the prefix into place. Anything is way to big for something so small.
        if ( config.classPrefix ) {
          output = output.replace("classPrefix : '',", "classPrefix : '" + config.classPrefix.replace(/"/g, '\\"') + "',");
        }
        //var outBox = document.getElementById('buildoutput');
        var outBoxMin = document.getElementById('generatedSource');
        var buildHash = generateBuildHash(config);
        var isDev = (buildHash == $('#dev-build-link').attr('href'));
        var buildType = isDev ? 'Development' : 'Custom';
        var banner = '/*! Modernizr 3.0.0-beta (' + buildType + ' Build) | MIT\n' +
                     ' *  Build: http://modernizr.com/download/' + buildHash + '\n' +
                     ' */\n';

        if ( $('#dontmin').is(':checked') ) {
          outBoxMin.innerHTML = banner + output;
        }
        else {
          require({context: 'build'}, ['uglifyjs2'], function (u2){
            var UglifyJS = u2.UglifyJS;
            outBoxMin.innerHTML = banner + minify(UglifyJS, output, {});
          });
        }

        // add in old hack for now, just so i don't forget
        //outBoxMin.innerHTML = uglify( output, ['--extra', '--unsafe'] ).replace( "return a.history&&history.pushState", "return !!(a.history&&history.pushState)" );
      }
    }, function (buildText) {
      console.log({ buildOutput: buildText });
    });
  }

  var extras = [
    {
      name: 'html5shiv v3.6.2',
      option: 'html5shiv'
    }, {
      name: 'html5shiv v3.6.2 w/ printshiv',
      option: 'html5printshiv'
    }, {
      name: 'Modernizr.load (<a href="http://yepnopejs.com/">YepNope.js</a>)',
      option: 'load'
    }, {
      name: 'Media Queries',
      option: 'mq'
    }, {
      name: 'Add CSS classes',
      option: 'setClasses',
      associatedValue: 'classPrefix'
    }
  ];
  var extensibility = [];

  // Load feature detects from metadata
  $.get('/i/js/modernizr-git/dist/metadata.json', function(detects) {
    var $fdList = $('#fd-list');
    var $helpBox = $('#help-box');
    var detectItemTpl = _.template($('#detect-item-tpl').html());
    var helpTpl = _.template($('#help-tpl').html());

    detects = _.sortBy(detects, function (detect) {
      return detect.name.toLowerCase();
    });
    $.each(detects, function (idx, detect) {
      var searchIndex = [detect.property, detect.amdPath, detect.name].concat(detect.tags).join('|').toLowerCase();
      var $li = $(detectItemTpl({
        detect: detect,
        searchIndex: searchIndex
      }));
      // On hover
      $('#fd-list').append($li);
    });

    $fdList.on('click', '.help-icon', function (evt) {
      var $help = $(helpTpl({
        name: this.getAttribute('data-name'),
        doc: this.getAttribute('data-doc')
      }));
      $helpBox.html($help).addClass('help-box--visible');

      evt.stopPropagation();
    });
    $(document).on('click', function () {
      $helpBox.html('');
      $helpBox.removeClass('help-box--visible');
    });

    $('#features-filter').on('input', function (evt) {
      console.log('input');
      if (!evt.currentTarget.value) {
        $('#features-filter-styles').text('');
      }
      else {
        $('#features-filter-styles').text('#fd-list li:not([data-index*="' + this.value.toLowerCase() + '"]) { display: none; }');
      }
    });

    // Only show classPrefix box when css classes are enabled
    var $setClassesChk = $('#setClasses input[type=checkbox]');
    function showHideClassPrefix (show) {
      if ($setClassesChk.prop('checked')) {
        $('#classPrefix').css('visibility', 'visible');
      }
      else {
        $('#classPrefix').css('visibility', 'hidden');
      }
    }
    $setClassesChk.on('change', function (evt) {
      showHideClassPrefix();
    });
    showHideClassPrefix();

    loadFromHash();
  });

  $('#generate').on('click', function () {
    var config = getBuildConfig();
    var buildHash = generateBuildHash(config);
    window.location.hash = buildHash;
  });

  $(window).on('hashchange', loadFromHash);

});
