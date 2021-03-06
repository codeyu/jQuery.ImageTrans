; (function ($) {
  var funcBind = function (fun, thisp) {
    var slice = Array.prototype.slice;
    var args = slice.call(arguments, 2);
    return function () {
      return fun.apply(thisp, args.concat(slice.call(arguments)));
    }
  }
  var ImageTrans = function (container, options) {
    this._initialize(container, options);
    this._initMode();
    if (this._support) {
      this._initContainer();
      this._init();
    } else {//模式不支持
      this.onError("not support");
    }
  };
  ImageTrans.prototype = {
    //初始化程序
    _initialize: function (container, options) {
      var container = this._container = $(container)[0];
      this._clientWidth = container.clientWidth;//变换区域宽度
      this._clientHeight = container.clientHeight;//变换区域高度
      this._img = new Image();//图片对象
      this._style = {};//备份样式
      this._x = this._y = 1;//水平/垂直变换参数
      this._radian = 0;//旋转变换参数
      this._support = false;//是否支持变换
      this._init = this._load = this._show = this._dispose = function () { };

      var opt = this._setOptions(options);

      this._zoom = opt.zoom;

      this.onPreLoad = opt.onPreLoad;
      this.onLoad = opt.onLoad;
      this.onError = opt.onError;

      this._LOAD = funcBind(function () {
        this.onLoad();
        this._load();
        this.reset();
        this._img.style.visibility = "visible";
      }, this);
      $(this).trigger("z_init");
    },
    //设置默认属性
    _setOptions: function (options) {
      this.options = {//默认值
        mode: "css3|filter|canvas",
        zoom: .1,//缩放比率
        onPreLoad: function () { },//图片加载前执行
        onLoad: function () { },//图片加载后执行
        onError: function (err) { }//出错时执行
      };
      return $.extend(this.options, options || {});
    },
    //模式设置
    _initMode: function () {
      var modes = ImageTrans.modes;
      this._support = this.options.mode.toLowerCase().split("|").some(function (mode) {
        mode = modes[mode];
        if (mode && mode.support) {
          mode.init && (this._init = mode.init);//初始化执行程序
          mode.load && (this._load = mode.load);//加载图片执行程序
          mode.show && (this._show = mode.show);//变换显示程序
          mode.dispose && (this._dispose = mode.dispose);//销毁程序
          //扩展变换方法
          var that = this;
          $.each(ImageTrans.transforms, function (name, transform) {

            that[name] = function () {
              transform.apply(that, [].slice.call(arguments));
              that._show();
            }
          }, that);
          return true;
        }
      }, this);
    },
    //初始化容器对象
    _initContainer: function () {
      var container = this._container, style = container.style, position = $(container).position();
      this._style = { "position": style.position, "overflow": style.overflow };//备份样式
      if (position != "relative" && position != "absolute") { style.position = "relative"; }
      style.overflow = "hidden";
      $(this).trigger("z_initContainer");
    },
    //加载图片
    load: function (src) {
      if (this._support) {
        var img = this._img, oThis = this;
        img.onload || (img.onload = this._LOAD);
        img.onerror || (img.onerror = function () { oThis.onError("err image"); });
        img.style.visibility = "hidden";
        this.onPreLoad();
        img.src = src;
      }
    },
    //重置
    reset: function () {
      if (this._support) {
        this._x = this._y = 1; this._radian = 0;
        this._show();
      }
    },
    //销毁程序
    dispose: function () {
      if (this._support) {
        this._dispose();
        $(this).trigger("z_dispose");
        $(this._container).css(this._style);//恢复样式
        this._container = this._img = this._img.onload = this._img.onerror = this._LOAD = null;
      }
    }
  };
  //变换模式
  ImageTrans.modes = function () {
    var css3Transform;//ccs3变换样式
    //初始化图片对象函数
    function initImg(img, container) {
      $(img).css({
        position: "absolute",
        border: 0, padding: 0, margin: 0, width: "auto", height: "auto",//重置样式
        visibility: "hidden"//加载前隐藏
      });
      container.appendChild(img);
    }
    //获取变换参数函数
    function getMatrix(radian, x, y) {
      var Cos = Math.cos(radian), Sin = Math.sin(radian);
      return {
        M11: Cos * x, M12: -Sin * y,
        M21: Sin * x, M22: Cos * y
      };
    }
    return {
      css3: {//css3设置
        support: function () {
          var style = document.createElement("div").style;
          return ["transform", "MozTransform", "webkitTransform", "OTransform"].some(
            function (css) {
              if (css in style) {
                css3Transform = css; return true;
              }
            });
        } (),
        init: function () { initImg(this._img, this._container); },
        load: function () {
          var img = this._img;
          $(img).css({//居中
            top: (this._clientHeight - img.offsetHeight) / 2 + "px",
            left: (this._clientWidth - img.offsetWidth) / 2 + "px",
            visibility: "visible"
          });
        },
        show: function () {
          var matrix = getMatrix(this._radian, this._y, this._x);
          //设置变形样式
          this._img.style[css3Transform] = "matrix("
            + matrix.M11.toFixed(16) + "," + matrix.M21.toFixed(16) + ","
            + matrix.M12.toFixed(16) + "," + matrix.M22.toFixed(16) + ", 0, 0)";
        },
        dispose: function () { 
            this._container.removeChild(this._img);    
        }
      },
      filter: {//滤镜设置
        support: function () { return "filters" in document.createElement("div"); } (),
        init: function () {
          initImg(this._img, this._container);
          //设置滤镜
          this._img.style.filter = "progid:DXImageTransform.Microsoft.Matrix(SizingMethod='auto expand')";
        },
        load: function () {
          this._img.onload = null;//防止ie重复加载gif的bug
          this._img.style.visibility = "visible";
        },
        show: function () {
          var img = this._img;
          //设置滤镜
          $.extend(
            img.filters.item("DXImageTransform.Microsoft.Matrix"),
            getMatrix(this._radian, this._y, this._x)
          );
          //保持居中
          img.style.top = (this._clientHeight - img.offsetHeight) / 2 + "px";
          img.style.left = (this._clientWidth - img.offsetWidth) / 2 + "px";
        },
        dispose: function () { 
          this._container.removeChild(this._img); 
        }
      },
      canvas: {//canvas设置
        support: function () { return "getContext" in document.createElement('canvas'); } (),
        init: function () {
          var canvas = this._canvas = document.createElement('canvas'),
            context = this._context = canvas.getContext('2d');
          //样式设置
          $(canvas).css({ position: "absolute", left: 0, top: 0 });
          canvas.width = this._clientWidth; canvas.height = this._clientHeight;
          this._container.appendChild(canvas);
        },
        show: function () {
          var img = this._img, context = this._context,
            clientWidth = this._clientWidth, clientHeight = this._clientHeight;
          //canvas变换
          context.save();
          context.clearRect(0, 0, clientWidth, clientHeight);//清空内容
          context.translate(clientWidth / 2, clientHeight / 2);//中心坐标
          context.rotate(this._radian);//旋转
          context.scale(this._y, this._x);//缩放
          context.drawImage(img, -img.width / 2, -img.height / 2);//居中画图
          context.restore();
        },
        dispose: function () {
          this._container.removeChild(this._canvas);
          this._canvas = this._context = null;
        }
      }
    };
  } ();
  //变换方法
  ImageTrans.transforms = {
    //垂直翻转
    vertical: function () {
      this._radian = Math.PI - this._radian; this._y *= -1;
    },
    //水平翻转
    horizontal: function () {
      this._radian = Math.PI - this._radian; this._x *= -1;
    },
    //根据弧度旋转
    rotate: function (radian) { this._radian = radian; },
    //向左转90度
    left: function () { this._radian -= Math.PI / 2; },
    //向右转90度
    right: function () { this._radian += Math.PI / 2; },
    //根据角度旋转
    rotatebydegress: function (degress) { this._radian = degress * Math.PI / 180; },
    //缩放
    scale: function () {
      function getZoom(scale, zoom) {
        return scale > 0 && scale > -zoom ? zoom :
          scale < 0 && scale < zoom ? -zoom : 0;
      }
      return function (zoom) {
        if (zoom) {
          var hZoom = getZoom(this._y, zoom), vZoom = getZoom(this._x, zoom);
          if (hZoom && vZoom) {
            this._y += hZoom; this._x += vZoom;
          }
        }
      }
    } (),
    //放大
    zoomin: function () { this.scale(Math.abs(this._zoom)); },
    //缩小
    zoomout: function () { this.scale(-Math.abs(this._zoom)); }
  };
  //滚轮缩放扩展
  ImageTrans.prototype._initialize = (function () {
    var firefox = /firefox/.test(navigator.userAgent.toLowerCase());
    var init = ImageTrans.prototype._initialize,
      mousewheel = firefox ? "DOMMouseScroll" : "mousewheel",
      methods = {
        "z_init": function () {
          this._mzZoom = funcBind(zoom, this);
        },
        "z_initContainer": function () {
          $(this._container).on(mousewheel, this._mzZoom);
        },
        "z_dispose": function () {
          $(this._container).off(mousewheel, this._mzZoom);
          this._mzZoom = null;
        }
      };
    //缩放函数
    function zoom(e) {
      this.scale((
        e.originalEvent.wheelDelta ? e.originalEvent.wheelDelta / (-120) : (e.originalEvent.detail || 0) / 3
      ) * Math.abs(this._zoom));
      e.preventDefault();
    };
    return function () {
      var options = arguments[1];
      if (!options || options.mouseZoom !== false) {
        //扩展钩子
        var that = this;
        $.each(methods, function (name, method) {
          $(that).on(name, method);
        }, that);
      }
      init.apply(this, arguments);
    }
  })();
  $.fn.ImageTrans = function (options) {
    return new ImageTrans(this, options);

  };
})(window.jQuery);