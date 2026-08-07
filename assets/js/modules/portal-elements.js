function requiredElement(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) {
    throw new Error(`Elemento obrigatório não encontrado: #${id}`);
  }
  return element;
}

export function getPortalElements(documentRef = document) {
  return {
    root: requiredElement(documentRef, 'viewRoot'),
    pageTitle: requiredElement(documentRef, 'pageTitle'),
    pageDescription: requiredElement(documentRef, 'pageDescription'),
    modeChip: requiredElement(documentRef, 'modeChip'),
    sidebar: requiredElement(documentRef, 'sidebar'),
    overlay: requiredElement(documentRef, 'sidebarOverlay'),
    modal: requiredElement(documentRef, 'modal'),
    modalBody: requiredElement(documentRef, 'modalBody'),
    modalTitle: requiredElement(documentRef, 'modalTitle'),
    confirmModal: requiredElement(documentRef, 'confirmModal'),
    confirmTitle: requiredElement(documentRef, 'confirmTitle'),
    confirmMessage: requiredElement(documentRef, 'confirmMessage'),
    confirmIcon: requiredElement(documentRef, 'confirmIcon'),
    confirmAccept: requiredElement(documentRef, 'confirmAccept'),
    confirmSecondary: requiredElement(documentRef, 'confirmSecondary'),
    confirmCancel: requiredElement(documentRef, 'confirmCancel'),
    importInput: requiredElement(documentRef, 'jsonImportInput'),
    imageInput: requiredElement(documentRef, 'imageInput'),
    toastRegion: requiredElement(documentRef, 'toastRegion'),
    clock: requiredElement(documentRef, 'clock'),
    currentDate: requiredElement(documentRef, 'currentDate'),
    portalRefreshButton: requiredElement(documentRef, 'portalRefreshButton'),
    publishCenter: {
      panel: requiredElement(documentRef, 'publishProgressNotice'),
      title: requiredElement(documentRef, 'publishProgressTitle'),
      detail: requiredElement(documentRef, 'publishProgressDetail'),
      popoverTitle: requiredElement(documentRef, 'publishPopoverTitle'),
      popoverDetail: requiredElement(documentRef, 'publishPopoverDetail'),
      bar: requiredElement(documentRef, 'publishProgressBar'),
      count: requiredElement(documentRef, 'publishCenterCount'),
      toggle: requiredElement(documentRef, 'publishCenterToggle'),
      closeButton: requiredElement(documentRef, 'publishCenterClose'),
      reviewButton: requiredElement(documentRef, 'publishCenterReview'),
      reviewSummary: requiredElement(documentRef, 'publishCenterReviewSummary'),
      sendButton: requiredElement(documentRef, 'publishCenterSend'),
      discardButton: requiredElement(documentRef, 'publishCenterDiscard')
    }
  };
}
