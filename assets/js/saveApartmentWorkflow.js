/**
 * Blacklist confirmation + retry with ignoreBlacklist; duplicate listings surface as in-app modals.
 */
(function (global) {
  function fallbackConfirm(message) {
    var FB = global.NyhomeUiFeedback;
    if (FB && typeof FB.confirm === 'function') {
      return FB.confirm(String(message || '') + '\n\nSave anyway?', {
        title: 'Blacklisted building',
        confirmLabel: 'Save anyway',
        cancelLabel: 'Go back',
      });
    }
    return Promise.resolve(global.confirm(String(message || '') + '\n\nSave anyway?'));
  }

  function confirmBlacklistDialog(message) {
    return new Promise(function (resolve) {
      var dlg = document.getElementById('nyhome-blacklist-dialog');
      var msgEl = document.getElementById('nyhome-blacklist-dialog-msg');
      if (!dlg || !msgEl) {
        fallbackConfirm(message).then(resolve);
        return;
      }
      msgEl.textContent = message || 'This building is on your blacklist.';

      var cancel = document.getElementById('nyhome-blacklist-cancel');
      var ok = document.getElementById('nyhome-blacklist-confirm');

      function onDialogClose() {
        dlg.removeEventListener('close', onDialogClose);
        dlg.removeEventListener('cancel', onEsc);
        if (cancel) cancel.removeEventListener('click', onCancelClick);
        if (ok) ok.removeEventListener('click', onOkClick);
        resolve(dlg.returnValue === 'confirm');
      }

      function onEsc(e) {
        e.preventDefault();
        try {
          dlg.close('dismiss');
        } catch (err) { /* empty */ }
      }

      function onCancelClick() {
        try {
          dlg.close('dismiss');
        } catch (e) { /* empty */ }
      }

      function onOkClick() {
        try {
          dlg.close('confirm');
        } catch (e) { /* empty */ }
      }

      if (typeof dlg.showModal !== 'function') {
        fallbackConfirm(message).then(resolve);
        return;
      }

      dlg.addEventListener('close', onDialogClose);
      dlg.addEventListener('cancel', onEsc);
      if (cancel) cancel.addEventListener('click', onCancelClick);
      if (ok) ok.addEventListener('click', onOkClick);

      try {
        dlg.showModal();
      } catch (e) {
        dlg.removeEventListener('close', onDialogClose);
        dlg.removeEventListener('cancel', onEsc);
        if (cancel) cancel.removeEventListener('click', onCancelClick);
        if (ok) ok.removeEventListener('click', onOkClick);
        fallbackConfirm(message).then(resolve);
      }
    });
  }

  /**
   * @param {function(object): Promise} saveFn e.g. NyhomeAPI.saveApartment
   * @param {function(boolean): object} buildPayload (forRetry) => payload; set forRetry true on blacklist retry
   */
  function saveApartmentRespectingBlacklist(saveFn, buildPayload) {
    var payload = buildPayload(false);
    return saveFn(payload).catch(function (err) {
      if (err.status === 409 && err.code === 'DUPLICATE_LISTING') {
        var FB = global.NyhomeUiFeedback;
        if (FB && typeof FB.alert === 'function') {
          return FB.alert(err.message || 'Duplicate listing.', { title: 'Duplicate' }).then(function () {
            throw err;
          });
        }
        if (global.alert) global.alert(err.message);
        throw err;
      }
      if (err.status === 409 && err.code === 'BLACKLISTED') {
        return confirmBlacklistDialog(err.message).then(function (yes) {
          if (!yes) throw err;
          var p2 = buildPayload(true);
          p2.ignoreBlacklist = true;
          return saveFn(p2);
        });
      }
      throw err;
    });
  }

  global.NyhomeSaveWorkflow = {
    confirmBlacklistDialog: confirmBlacklistDialog,
    saveApartmentRespectingBlacklist: saveApartmentRespectingBlacklist,
  };
})(typeof self !== 'undefined' ? self : this);
