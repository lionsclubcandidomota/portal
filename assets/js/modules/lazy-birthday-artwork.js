export function createLazyBirthdayArtworkShare({ getBirthdays, toast }) {
  if (typeof getBirthdays !== 'function') {
    throw new TypeError('createLazyBirthdayArtworkShare requer getBirthdays().');
  }
  if (typeof toast !== 'function') {
    throw new TypeError('createLazyBirthdayArtworkShare requer toast().');
  }

  let controllerPromise = null;
  return async personId => {
    if (!controllerPromise) {
      controllerPromise = import('./birthday-artwork.js?v=6.36.0')
        .then(({ createBirthdayArtworkController }) => createBirthdayArtworkController({ getBirthdays, toast }))
        .catch(error => {
          controllerPromise = null;
          throw error;
        });
    }
    const controller = await controllerPromise;
    return controller.share(personId);
  };
}
