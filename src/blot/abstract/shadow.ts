import ParchmentError from '../../error.js';
import Registry from '../../registry.js';
import Scope from '../../scope.js';
import type {
  Blot,
  BlotConstructor,
  Formattable,
  Parent,
  Root,
} from './blot.js';

class ShadowBlot implements Blot {
  public static blotName = 'abstract';
  public static className: string;
  public static requiredContainer: BlotConstructor;
  public static scope: Scope;
  public static tagName: string | string[];

  /*
  * 通过blot 类中的 tagName 创建真实dom
  * this永远指向 new  blot 的那个类
  */ 
  public static create(rawValue?: unknown): Node {
    if (this.tagName == null) {  // 取自实例构造函数类的静态tagName 字段
      throw new ParchmentError('Blot definition missing tagName');
    }
    let node: HTMLElement;
    let value: string | number | undefined;
    if (Array.isArray(this.tagName)) {
      if (typeof rawValue === 'string') {
        value = rawValue.toUpperCase();
        if (parseInt(value, 10).toString() === value) {
          value = parseInt(value, 10);
        }
      } else if (typeof rawValue === 'number') {
        value = rawValue;
      }
      if (typeof value === 'number') {
        node = document.createElement(this.tagName[value - 1]);
      } else if (value && this.tagName.indexOf(value) > -1) {
        node = document.createElement(value);
      } else {
        node = document.createElement(this.tagName[0]);
      }
    } else {
      node = document.createElement(this.tagName);
    }
    if (this.className) {
      node.classList.add(this.className);
    }
    return node;
  }

  public prev: Blot | null;
  public next: Blot | null;
  // @ts-expect-error Fix me later
  public parent: Parent;

  // Hack for accessing inherited static methods
  
  // 返回new A() 中A类而非 ShadowBlot，可以访问类的静态属性和方法eg: A.create()
  get statics(): any {
    return this.constructor;
  }
  /*
  *注意这种写法，ts 独有的通过 访问修饰符自动赋值并创建成员变量
  * 功能： 给当前实例对象 prev、next、 scroll、domNode
  */ 
  constructor(
    public scroll: Root,
    public domNode: Node,
  ) {
    Registry.blots.set(domNode, this);
    this.prev = null;
    this.next = null;
  }
  //
  public attach(): void {
    // Nothing to do
  }
  // 复制一个dom, 并实例化对应的blot
  public clone(): Blot {
    // 浅复制，不包含子div
    const domNode = this.domNode.cloneNode(false);
    return this.scroll.create(domNode);
  }

  // 卸载相关方法，删除blot,删除domNode对blot 的映射
  public detach(): void {
    if (this.parent != null) {
      this.parent.removeChild(this);  // 调用parent.ts 中的removeChild 方法
    }
    Registry.blots.delete(this.domNode);
  }

  public deleteAt(index: number, length: number): void {
    const blot = this.isolate(index, length);
    blot.remove();
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: any,
  ): void {
    const blot = this.isolate(index, length);
    if (this.scroll.query(name, Scope.BLOT) != null && value) {
      blot.wrap(name, value);
    } else if (this.scroll.query(name, Scope.ATTRIBUTE) != null) {
      const parent = this.scroll.create(this.statics.scope) as Parent &
        Formattable;
      blot.wrap(parent);
      parent.format(name, value);
    }
  }

  public insertAt(index: number, value: string, def?: any): void {
    const blot =
      def == null
        ? this.scroll.create('text', value)
        : this.scroll.create(value, def);
    const ref = this.split(index);
    this.parent.insertBefore(blot, ref || undefined);
  }

  public isolate(index: number, length: number): Blot {
    const target = this.split(index);
    if (target == null) {
      throw new Error('Attempt to isolate at end');
    }
    target.split(length);
    return target;
  }

  public length(): number {
    return 1;
  }
  // 光标计算 偏移量 selection.ts
  public offset(root: Blot = this.parent): number {
    if (this.parent == null || this === root) {
      return 0;
    }
    return this.parent.children.offset(this) + this.parent.offset(root);
  }

  // 
  public optimize(_context?: { [key: string]: any }): void {
    if (
      this.statics.requiredContainer &&
      !(this.parent instanceof this.statics.requiredContainer)
    ) {
      this.wrap(this.statics.requiredContainer.blotName);
    }
  }

  public remove(): void {
    if (this.domNode.parentNode != null) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
    this.detach();
  }

  public replaceWith(name: string | Blot, value?: any): Blot {
    const replacement =
      typeof name === 'string' ? this.scroll.create(name, value) : name;
    if (this.parent != null) {
      this.parent.insertBefore(replacement, this.next || undefined);
      this.remove();
    }
    return replacement;
  }

  public split(index: number, _force?: boolean): Blot | null {
    return index === 0 ? this : this.next;
  }

  public update(
    _mutations: MutationRecord[],
    _context: { [key: string]: any },
  ): void {
    // Nothing to do by default
  }

  public wrap(name: string | Parent, value?: any): Parent {
    const wrapper =
      typeof name === 'string'
        ? (this.scroll.create(name, value) as Parent)
        : name;
    if (this.parent != null) {
      this.parent.insertBefore(wrapper, this.next || undefined);
    }
    if (typeof wrapper.appendChild !== 'function') {
      throw new ParchmentError(`Cannot wrap ${name}`);
    }
    wrapper.appendChild(this);
    return wrapper;
  }
}

export default ShadowBlot;
