import Attributor from '../attributor/attributor.js';
import AttributorStore from '../attributor/store.js';
import Scope from '../scope.js';
import type {
  Blot,
  BlotConstructor,
  Formattable,
  Parent,
  Root,
} from './abstract/blot.js';
import LeafBlot from './abstract/leaf.js';
import ParentBlot from './abstract/parent.js';

// Shallow object comparison
function isEqual(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
): boolean {
  if (Object.keys(obj1).length !== Object.keys(obj2).length) {
    return false;
  }
  for (const prop in obj1) {
    if (obj1[prop] !== obj2[prop]) {
      return false;
    }
  }
  return true;
}

class InlineBlot extends ParentBlot implements Formattable {
  public static allowedChildren: BlotConstructor[] = [InlineBlot, LeafBlot];
  public static blotName = 'inline';
  public static scope = Scope.INLINE_BLOT;
  public static tagName: string | string[] = 'SPAN';

  static create(value?: unknown) {
    return super.create(value) as HTMLElement;
  }

  public static formats(domNode: HTMLElement, scroll: Root): any {
    const match = scroll.query(InlineBlot.blotName);
    if (
      match != null &&
      domNode.tagName === (match as BlotConstructor).tagName
    ) {
      return undefined;
    } else if (typeof this.tagName === 'string') {
      return true;
    } else if (Array.isArray(this.tagName)) {
      return domNode.tagName.toLowerCase();
    }
    return undefined;
  }

  protected attributes: AttributorStore;

  constructor(scroll: Root, domNode: Node) {
    super(scroll, domNode);
    this.attributes = new AttributorStore(this.domNode);
  }

  public format(name: string, value: any): void {
    // 取消格式化
    if (name === this.statics.blotName && !value) {
      this.children.forEach((child) => {
        if (!(child instanceof InlineBlot)) { // textblot 就不是 inlineBlot 实例
          child = child.wrap(InlineBlot.blotName, true); // textBlot 作为InlineBlot的children
        }
        this.attributes.copy(child as InlineBlot);
      });
      this.unwrap();
    } else {
    // 添加格式化
      const format = this.scroll.query(name, Scope.INLINE);
      if (format == null) {
        return;
      }
      if (format instanceof Attributor) { // size
        this.attributes.attribute(format, value);
      } else if (
        value &&
        (name !== this.statics.blotName || this.formats()[name] !== value)
      ) {
        this.replaceWith(name, value);
      }
    }
  }

  public formats(): { [index: string]: any } {
    // {}
    const formats = this.attributes.values();
    // 基层inline blot 自己的静态方法 formats，这么看继承inlineblot 的必须写 静态方法formats？
    // link -> 自己的 方法 return domNode.getAttribute('href');
    const format = this.statics.formats(this.domNode, this.scroll);
    if (format != null) {
      // eg： bold => {bold: true}
      // eg： link => {link: 'http://localhost:9000/'} {name: value}
      formats[this.statics.blotName] = format;
    }
    return formats;
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: any,
  ): void {
     // 取消格式化
    if (
      this.formats()[name] != null ||
      this.scroll.query(name, Scope.ATTRIBUTE)
    ) {
      const blot = this.isolate(index, length) as InlineBlot;
      blot.format(name, value); // 上面自己的form方法
    } else {
      // 新增格式化
      super.formatAt(index, length, name, value);
    }
  }

  public optimize(context: { [key: string]: any }): void {
    super.optimize(context);
    const formats = this.formats();
    // 格式紧凑方法，将去除多余的span , eg: 123<span>678</span>
    if (Object.keys(formats).length === 0) {
      return this.unwrap(); // unformatted span
    }
    const next = this.next;
    if (
      next instanceof InlineBlot &&
      next.prev === this &&
      isEqual(formats, next.formats())
    ) {
      next.moveChildren(this);
      next.remove();
    }
  }

  public replaceWith(name: string | Blot, value?: any): Blot {
    const replacement = super.replaceWith(name, value) as InlineBlot;
    this.attributes.copy(replacement);
    return replacement;
  }

  public update(
    mutations: MutationRecord[],
    context: { [key: string]: any },
  ): void {
    super.update(mutations, context);
    const attributeChanged = mutations.some(
      (mutation) =>
        mutation.target === this.domNode && mutation.type === 'attributes',
    );
    if (attributeChanged) {
      this.attributes.build();
    }
  }

  public wrap(name: string | Parent, value?: any): Parent {
    const wrapper = super.wrap(name, value);
    if (wrapper instanceof InlineBlot) {
      this.attributes.move(wrapper);
    }
    return wrapper;
  }
}

export default InlineBlot;
