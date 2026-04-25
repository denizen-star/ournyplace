(function (global) {
  var MAX_IMAGES = 3;
  var MAX_EDGE = 1600;
  var JPEG_QUALITY = 0.82;

  function fileToCompressedDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image') !== 0) {
        reject(new Error('Not an image file'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error('Invalid image dimensions'));
          return;
        }
        var scale = 1;
        if (w > MAX_EDGE || h > MAX_EDGE) {
          scale = Math.min(MAX_EDGE / w, MAX_EDGE / h);
        }
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });
  }

  function clipboardImageFileFromEvent(e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'file' && it.type && it.type.indexOf('image') === 0) {
        return it.getAsFile();
      }
    }
    for (var j = 0; j < items.length; j++) {
      if (items[j].type && items[j].type.indexOf('image') === 0) {
        return items[j].getAsFile();
      }
    }
    return null;
  }

  global.NyhomeVibeImages = {
    MAX: MAX_IMAGES,
    fileToCompressedDataUrl: fileToCompressedDataUrl,
    clipboardImageFileFromEvent: clipboardImageFileFromEvent,
  };
})(typeof window !== 'undefined' ? window : this);
