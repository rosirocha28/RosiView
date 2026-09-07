/**
 * RosiView — Formula Node
 * Bloco de Expressão / Fórmula Matemática estilo LabVIEW Formula Node
 * Avalia expressões matemáticas personalizadas, regras condicionais de histerese e calibrações
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class FormulaNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'formula_node', title: 'Formula Node', icon: 'fx' });
    
    this.code = opts.code || 'y = x;';
    
    // Entradas e Saídas Dinâmicas
    if (opts.inputNames && Array.isArray(opts.inputNames)) {
      opts.inputNames.forEach(name => this.addInput(name, DataTypes.DOUBLE, 0));
    } else {
      this.addInput('x', DataTypes.DOUBLE, 0);
    }

    if (opts.outputNames && Array.isArray(opts.outputNames)) {
      opts.outputNames.forEach(name => this.addOutput(name, DataTypes.DOUBLE, 0));
    } else {
      this.addOutput('y', DataTypes.DOUBLE, 0);
    }
  }

  setCode(newCode) {
    this.code = newCode;
  }

  execute(context = {}) {
    try {
      // Prepara variáveis de entrada no escopo
      const scope = {};
      for (const [, input] of this.inputs) {
        scope[input.name] = Number(input.value) || 0;
      }
      
      // Adiciona variáveis de contexto se disponíveis (tempo t, dt)
      if (context.t !== undefined && !scope.t) scope.t = context.t;
      if (context.dt !== undefined && !scope.dt) scope.dt = context.dt;

      // Inicializa variáveis de saída
      for (const [, output] of this.outputs) {
        scope[output.name] = output.value !== undefined ? output.value : 0;
      }

      // Função de avaliação segura com funções matemáticas padrão (exp, sin, cos, sqrt, pow, abs, max, min)
      const mathHelpers = {
        exp: Math.exp,
        sin: Math.sin,
        cos: Math.cos,
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        max: Math.max,
        min: Math.min,
        PI: Math.PI
      };

      // Execução do código da fórmula em contexto isolado
      const varNames = Object.keys(scope);
      const varValues = Object.values(scope);
      const mathNames = Object.keys(mathHelpers);
      const mathValues = Object.values(mathHelpers);

      // Tratamento para expressões simples "y = Kp*x" ou scripts com if/else
      let executableCode = this.code;
      // Garante que retorne o escopo modificado
      const returnObjCode = `return { ${Array.from(this.outputs.values()).map(o => `${o.name}: (typeof ${o.name} !== 'undefined' ? ${o.name} : 0)`).join(', ')} };`;
      
      const fn = new Function(...mathNames, ...varNames, `
        ${executableCode}
        ${returnObjCode}
      `);

      const result = fn(...mathValues, ...varValues);

      // Atribui os resultados calculados aos terminais de saída
      for (const [, output] of this.outputs) {
        if (result && result[output.name] !== undefined) {
          output.value = result[output.name];
        }
      }
    } catch (err) {
      console.warn(`Erro no Formula Node (${this.title}):`, err);
    }
  }

  toJSON() {
    const json = super.toJSON();
    json.code = this.code;
    json.inputNames = Array.from(this.inputs.values()).map(i => i.name);
    json.outputNames = Array.from(this.outputs.values()).map(o => o.name);
    return json;
  }
}
