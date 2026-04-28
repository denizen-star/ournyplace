/**
 * In-app toast (success) and modal alert/confirm (replaces window.alert / confirm).
 * Injects <dialog> and toast host on first use.
 */
(function (global) {
  var TOAST_DURATION_MS = 5200;

  function ensureToastHost() {
    var el = document.getElementById('nyhome-toast-host');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'nyhome-toast-host';
    el.className = 'nyhome-toast-host';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
  }

  function showToast(message, options) {
    var msg = String(message || '').trim() || 'Done.';
    var opts = options || {};
    var ms = opts.durationMs != null ? opts.durationMs : TOAST_DURATION_MS;
    var host = ensureToastHost();
    var div = document.createElement('div');
    div.className = 'nyhome-toast';
    if (opts.variant === 'error') div.classList.add('nyhome-toast--error');
    div.textContent = msg;
    host.appendChild(div);
    requestAnimationFrame(function () {
      div.classList.add('nyhome-toast--visible');
    });
    setTimeout(function () {
      div.classList.remove('nyhome-toast--visible');
      setTimeout(function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 320);
    }, ms);
  }

  function dialogSupported() {
    return typeof HTMLDialogElement !== 'undefined';
  }

  function getAlertDialog() {
    var dlg = document.getElementById('nyhome-feedback-alert');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'nyhome-feedback-alert';
    dlg.className = 'nyhome-modal nyhome-feedback-dialog';
    dlg.setAttribute('aria-labelledby', 'nyhome-feedback-alert-title');
    dlg.innerHTML =
      '<div class="nyhome-modal-inner">' +
      '<h2 class="nyhome-modal-title" id="nyhome-feedback-alert-title" data-feedback-alert-title></h2>' +
      '<p class="nyhome-modal-msg muted" data-feedback-alert-msg></p>' +
      '<div class="nyhome-modal-actions">' +
      '<button type="button" class="primary-btn" data-feedback-alert-ok>OK</button>' +
      '</div></div>';
    document.body.appendChild(dlg);
    return dlg;
  }

  function getConfirmDialog() {
    var dlg = document.getElementById('nyhome-feedback-confirm');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'nyhome-feedback-confirm';
    dlg.className = 'nyhome-modal nyhome-feedback-dialog';
    dlg.setAttribute('aria-labelledby', 'nyhome-feedback-confirm-title');
    dlg.innerHTML =
      '<div class="nyhome-modal-inner">' +
      '<h2 class="nyhome-modal-title" id="nyhome-feedback-confirm-title" data-feedback-confirm-title></h2>' +
      '<p class="nyhome-modal-msg muted" data-feedback-confirm-msg></p>' +
      '<div class="nyhome-modal-actions">' +
      '<button type="button" class="secondary-btn" data-feedback-confirm-cancel>Cancel</button>' +
      '<button type="button" class="primary-btn" data-feedback-confirm-ok>OK</button>' +
      '</div></div>';
    document.body.appendChild(dlg);
    return dlg;
  }

  /**
   * @param {string} message
   * @param {{ title?: string }} [options]
   * @returns {Promise<void>}
   */
  function alertModal(message, options) {
    var opt = options || {};
    if (!dialogSupported()) {
      global.alert(String(message || ''));
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var dlg = getAlertDialog();
      var titleEl = dlg.querySelector('[data-feedback-alert-title]');
      var msgEl = dlg.querySelector('[data-feedback-alert-msg]');
      var ok = dlg.querySelector('[data-feedback-alert-ok]');
      if (!titleEl || !msgEl || !ok) {
        global.alert(String(message || ''));
        resolve();
        return;
      }
      titleEl.textContent = opt.title || 'Notice';
      msgEl.textContent = String(message || '');

      function cleanup() {
        dlg.removeEventListener('close', onClose);
        dlg.removeEventListener('cancel', onEsc);
        ok.removeEventListener('click', onOk);
      }

      function onClose() {
        cleanup();
        resolve();
      }

      function onEsc(e) {
        e.preventDefault();
        try {
          dlg.close('dismiss');
        } catch (err) { /* empty */ }
      }

      function onOk() {
        try {
          dlg.close('ok');
        } catch (err) { /* empty */ }
      }

      dlg.addEventListener('close', onClose, { once: true });
      dlg.addEventListener('cancel', onEsc);
      ok.addEventListener('click', onOk);

      try {
        dlg.showModal();
        ok.focus();
      } catch (err) {
        cleanup();
        global.alert(String(message || ''));
        resolve();
      }
    });
  }

  /**
   * @param {string} message
   * @param {{ destructive?: boolean, title?: string, confirmLabel?: string, cancelLabel?: string }} [options]
   * @returns {Promise<boolean>}
   */
  function confirmModal(message, options) {
    var opt = options || {};
    if (!dialogSupported()) {
      return Promise.resolve(global.confirm(String(message || '')));
    }
    return new Promise(function (resolve) {
      var dlg = getConfirmDialog();
      var titleEl = dlg.querySelector('[data-feedback-confirm-title]');
      var msgEl = dlg.querySelector('[data-feedback-confirm-msg]');
      var cancelBtn = dlg.querySelector('[data-feedback-confirm-cancel]');
      var okBtn = dlg.querySelector('[data-feedback-confirm-ok]');
      if (!titleEl || !msgEl || !cancelBtn || !okBtn) {
        resolve(global.confirm(String(message || '')));
        return;
      }
      titleEl.textContent = opt.title || 'Confirm';
      msgEl.textContent = String(message || '');
      cancelBtn.textContent = opt.cancelLabel || 'Cancel';
      okBtn.textContent = opt.confirmLabel || 'OK';
      okBtn.className = opt.destructive ? 'primary-btn primary-btn--danger' : 'primary-btn';

      function cleanup() {
        dlg.removeEventListener('close', onClose);
        dlg.removeEventListener('cancel', onEsc);
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
      }

      function onClose() {
        cleanup();
        resolve(dlg.returnValue === 'confirm');
      }

      function onEsc(e) {
        e.preventDefault();
        try {
          dlg.close('dismiss');
        } catch (err) { /* empty */ }
      }

      function onCancel() {
        try {
          dlg.close('dismiss');
        } catch (err) { /* empty */ }
      }

      function onOk() {
        try {
          dlg.close('confirm');
        } catch (err) { /* empty */ }
      }

      dlg.addEventListener('close', onClose, { once: true });
      dlg.addEventListener('cancel', onEsc);
      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);

      try {
        dlg.showModal();
        cancelBtn.focus();
      } catch (err) {
        cleanup();
        resolve(global.confirm(String(message || '')));
      }
    });
  }

  global.NyhomeUiFeedback = {
    showToast: showToast,
    alert: alertModal,
    confirm: confirmModal,
  };
})(typeof self !== 'undefined' ? self : this);
