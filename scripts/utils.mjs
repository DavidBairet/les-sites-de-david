import { minify } from 'html-minifier-terser';

/**
 * Minifie le HTML généré
 * @param {string} html - Code HTML à minifier
 * @returns {Promise<string>} - HTML minifié
 */
export async function minifyHtml(html) {
  try {
    return await minify(html, {
      collapseWhitespace: true,           // Supprime les espaces inutiles
      removeComments: true,               // Retire les commentaires
      removeRedundantAttributes: true,    // Supprime les attributs par défaut
      removeEmptyAttributes: true,        // Supprime les attributs vides
      removeOptionalTags: false,          // On garde certaines balises optionnelles pour éviter les bugs
      minifyCSS: true,                     // Minifie le CSS inline
      minifyJS: true,                      // Minifie le JS inline
      keepClosingSlash: true               // Garde la fermeture des balises autofermantes
    });
  } catch (error) {
    console.error("Erreur lors de la minification HTML :", error);
    return html; // En cas d'erreur, on renvoie l'HTML original non minifié
  }
}
