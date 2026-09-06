/**
 * RosiView — Wire Router
 * Calcula caminhos visuais suaves (Curvas Bezier e Ortogonais) para os fios de conexão
 */

export class WireRouter {
  /**
   * Gera o atributo SVG 'd' para uma curva suave entre ponto inicial e final
   */
  static getCubicBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const offset = Math.max(dx * 0.5, 35);
    
    const cp1x = x1 + offset;
    const cp1y = y1;
    const cp2x = x2 - offset;
    const cp2y = y2;

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }

  /**
   * Gera um caminho ortogonal com cantos chanfrados ou retos estilo LabVIEW clássico
   */
  static getOrthogonalPath(x1, y1, x2, y2) {
    const midX = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
}
