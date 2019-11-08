"use strict";

exports.__esModule = true;
exports.default = isReadyProperty;

function isReadyProperty({
  types: t,
  template
}) {
  const statements = template.ast(`
    const key=this.resolve(props)
    if (this.resolved[key] === false) {
      return false
    }

    if (typeof __webpack_modules__ !== 'undefined') {
      return !!(__webpack_modules__[key])
    }

    return false
  `);
  return () => t.objectMethod('method', t.identifier('isReady'), [t.identifier('props')], t.blockStatement(statements));
}