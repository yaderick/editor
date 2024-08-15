import Attributor from './attributor/attributor.js';
import {
  type Blot,
  type BlotConstructor,
  type Root,
} from './blot/abstract/blot.js';
import ParchmentError from './error.js';
import Scope from './scope.js';

export type RegistryDefinition = Attributor | BlotConstructor;

export interface RegistryInterface {
  create(scroll: Root, input: Node | string | Scope, value?: any): Blot;
  query(query: string | Node | Scope, scope: Scope): RegistryDefinition | null;
  register(...definitions: any[]): any;
}

// find 查找blot 实例， query 查找 blot 类  二者区别

export default class Registry implements RegistryInterface {
  public static blots = new WeakMap<Node, Blot>();

  // 通过原生dom 查找对应的blot 实例， bubble 为true 会一直冒泡往上找父节点 尤其是nodeType 为#text类型时 要找到父容器节点 
  public static find(node?: Node | null, bubble = false): Blot | null {
    if (node == null) {
      return null;
    }
    // #text blot 直接返回 以前注册过，如果没有走递归找父节点
    if (this.blots.has(node)) {
      return this.blots.get(node) || null;
    }
    if (bubble) {
      let parentNode: Node | null = null;
      try {
        parentNode = node.parentNode; // 原生dom的parentNode
      } catch (err) {
        // Probably hit a permission denied error.
        // A known case is in Firefox, event targets can be anonymous DIVs
        // inside an input element.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=208427
        return null;
      }
      return this.find(parentNode, bubble);
    }
    return null;
  }

  private attributes: { [key: string]: Attributor } = {};
  private classes: { [key: string]: BlotConstructor } = {}; 
  private tags: { [key: string]: BlotConstructor } = {}; // tagName 记录
  private types: { [key: string]: RegistryDefinition } = {}; // blotName 记录

  /**
   *  如果input 是domNode ，则通过是domNode查找对应的blot 类，
   *  如果 input 是blotName, 则通过blotName查找对应的blot 类
   *   实例化所有的blot
   * 
   *  首先通过blotname 查找注册对用的blot类
   *  其次 调用blot类 的create 方法，通常是调用 shaowdblot 的create 方法 通过blot 的tagName 生成 真实dom
   *  最后实例化 blot 返回
  */
  public create(scroll: Root, input: Node | string | Scope, value?: any): Blot {
    // 根据 input（blotName） 查询 blotName 所注册的类
    const match = this.query(input); // Blot 类 
    if (match == null) {
      throw new ParchmentError(`Unable to create ${input} blot`);
    }
    const blotClass = match as BlotConstructor;
    // block 继承 parentBlot 继承 shadowBlot 中的create 方法； 将 blockBlot 中的 tagName （p） 创建成真实的对应dom <p></p>
    const node =
      // @ts-expect-error Fix me later
      input instanceof Node || input.nodeType === Node.TEXT_NODE
        ? input
        : blotClass.create(value); // <p></p> 通过tagName创建真实dom

    const blot = new blotClass(scroll, node as Node, value);
    Registry.blots.set(blot.domNode, blot);
    return blot;
  }
  // 通过实例函数调用静态方法的示例 或者通过构造函数取静态方法
  public find(node: Node | null, bubble = false): Blot | null {
    return Registry.find(node, bubble);
  }








  
  // 查找blot 类
  public query(
    query: string | Node | Scope,
    scope: Scope = Scope.ANY,
  ): RegistryDefinition | null {
    let match;
    // 通过blotname 查找对应的 类
    if (typeof query === 'string') {  // blotName
      match = this.types[query] || this.attributes[query];
      // @ts-expect-error Fix me later
    } else if (query instanceof Text || query.nodeType === Node.TEXT_NODE) {  // 文本节点
      match = this.types.text;
    } else if (typeof query === 'number') {
      if (query & Scope.LEVEL & Scope.BLOCK) {
        match = this.types.block;
      } else if (query & Scope.LEVEL & Scope.INLINE) {
        match = this.types.inline;
      }
    } else if (query instanceof Element) {  // clone 方法调用
      const names = (query.getAttribute('class') || '').split(/\s+/);
      names.some((name) => {
        match = this.classes[name];
        if (match) {
          return true;
        }
        return false;
      });
      match = match || this.tags[query.tagName];
    }
    if (match == null) {
      return null;
    }
    if (
      'scope' in match &&
      scope & Scope.LEVEL & match.scope &&
      scope & Scope.TYPE & match.scope
    ) {
      return match;
    }
    return null;
  }
  /**
   * 只有blots/* 和formats/* 开头的才会全局注册
   * 
   * 方法声明出...是聚合参数为数组，方法调用处...是展开参数 
   * 例1:const add = (...res) => {console.log(res)} // [1,2,3]
   * add(1,2,3) // 聚合
   * 例2： const add = (a,b,c) => {console.log(a, b, c)}
   * const payload = [1,2,3]
   * add(...payload) // 展开
   * 
   * 调用register(Block), 所以definitions=[Block]
   * 
   * */ 
  public register(...definitions: RegistryDefinition[]): RegistryDefinition[] {
    return definitions.map((definition) => {
      const isBlot = 'blotName' in definition;
      const isAttr = 'attrName' in definition;
      if (!isBlot && !isAttr) {
        throw new ParchmentError('Invalid definition');
      } else if (isBlot && definition.blotName === 'abstract') {
        throw new ParchmentError('Cannot register abstract class');
      }
      const key = isBlot
        ? definition.blotName
        : isAttr
          ? definition.attrName
          : (undefined as never); // already handled by above checks
      this.types[key] = definition;

      if (isAttr) {
        if (typeof definition.keyName === 'string') {
          this.attributes[definition.keyName] = definition;
        }
      } else if (isBlot) {
        if (definition.className) {
          this.classes[definition.className] = definition;
        }
        if (definition.tagName) {
          if (Array.isArray(definition.tagName)) {
            definition.tagName = definition.tagName.map((tagName: string) => {
              return tagName.toUpperCase();
            });
          } else {
            definition.tagName = definition.tagName.toUpperCase();
          }

          const tagNames = Array.isArray(definition.tagName)
            ? definition.tagName
            : [definition.tagName];

          tagNames.forEach((tag: string) => {
            if (this.tags[tag] == null || definition.className == null) {
              this.tags[tag] = definition;
            }
          });
        }
      }
      return definition;
    });
  }
}
