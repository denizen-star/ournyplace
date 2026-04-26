/**
 * Blacklist confirmation + retry with ignoreBlacklist; duplicate listings surface as alerts.
 */
(function (global) {
  function confirmBlacklistDialog(message) {
    return new Promise(function (resolve) {
      var dlg = document.getElementById('nyhome-blacklist-dialog');
      var msgEl = document.getElementById('nyhome-blacklist-dialog-msg');
      if (!dlg || !msgEl) {
        resolve(global.confirm(String(message || '') + '\n\nSave anyway?'));
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
        resolve(global.confirm(String(message || '') + '\n\nSave anyway?'));
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
        resolve(global.confirm(String(message || '') + '\n\nSave anyway?'));
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
