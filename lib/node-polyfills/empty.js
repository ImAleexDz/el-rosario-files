// Turbopack no polyfilla módulos core de Node (fs, path) para el bundle del
// navegador. Los paquetes WASM de Cornerstone (codecs charls/openjpeg/etc.)
// hacen require('fs')/require('path') dentro de una rama `if (ENVIRONMENT_IS_NODE)`
// que nunca se ejecuta en el navegador, pero el bundler igual intenta
// resolverlos. Este módulo vacío es el destino de ese alias para que
// resuelva sin error; nunca se invoca en tiempo de ejecución.
module.exports = {};
