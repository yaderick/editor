import Registry, { type RegistryDefinition } from '../registry.js';
import Scope from '../scope.js';
import type { Blot, BlotConstructor, Root } from './abstract/blot.js';
import ContainerBlot from './abstract/container.js';
import ParentBlot from './abstract/parent.js';
import BlockBlot from './block.js';

const OBSERVER_CONFIG = {
  attributes: true,  // 属性变化
  characterData: true,  // 文本变化
  characterDataOldValue: true,
  childList: true,  // 监听子节点的添加、移除或替换
  subtree: true,  // 监听所有后代节点的变化
};

const MAX_OPTIMIZE_ITERATIONS = 100;

class ScrollBlot extends ParentBlot implements Root {
  public static blotName = 'scroll';
  public static defaultChild = BlockBlot;
  public static allowedChildren: BlotConstructor[] = [BlockBlot, ContainerBlot];
  public static scope = Scope.BLOCK_BLOT;
  public static tagName = 'DIV';

  public observer: MutationObserver;

  constructor(
    public registry: Registry,
    node: HTMLDivElement,
  ) {
    // @ts-expect-error scroll is the root with no parent
    super(null, node);
    this.scroll = this;
    this.build();
    /*
    * MutationRecord: type: attributes 时， attributeName: 'class'， 只表示对className 有修改，不清楚是增还是删
    */
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      console.log(mutations, 'mutations2')
      this.update(mutations);
    });
    this.observer.observe(this.domNode, OBSERVER_CONFIG);
    this.attach();
  }

  // 通过domNode 实例化对应的blot
  public create(input: Node | string | Scope, value?: any): Blot {
    return this.registry.create(this, input, value);
  }

  // bubble 收否冒泡， true的话 返回最上层根节点
  public find(node: Node | null, bubble = false): Blot | null {
    const blot = this.registry.find(node, bubble);
    if (!blot) {
      return null;
    }
    if (blot.scroll === this) {
      return blot;
    }
    return bubble ? this.find(blot.scroll.domNode.parentNode, true) : null;
  }

  public query(
    query: string | Node | Scope,
    scope: Scope = Scope.ANY,
  ): RegistryDefinition | null {
    return this.registry.query(query, scope);
  }

  public register(...definitions: RegistryDefinition[]) {
    return this.registry.register(...definitions);
  }

  // 给当前实例对象增加children = {head,tail,length } (new LinkedList() ) 
  public build(): void {
    if (this.scroll == null) {
      return;
    }
    super.build();
  }
  // 销毁
  public detach(): void {
    super.detach();
    this.observer.disconnect();
  }

  public deleteAt(index: number, length: number): void {
    this.update();
    if (index === 0 && length === this.length()) {
      this.children.forEach((child) => {
        child.remove();
      });
    } else {
      super.deleteAt(index, length);
    }
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: any,
  ): void {
    this.update();
    super.formatAt(index, length, name, value);
  }

  public insertAt(index: number, value: string, def?: any): void {
    this.update();
    super.insertAt(index, value, def);
  }

  // 遍历所有blot 将其给到父节点的optimize 实例化
  public optimize(context?: { [key: string]: any }): void;
  public optimize(
    mutations: MutationRecord[],
    context: { [key: string]: any },
  ): void;
  public optimize(mutations: any = [], context: any = {}): void {
    // 维护好根节点和子节点，并插入dom
    super.optimize(context);
    const mutationsMap = context.mutationsMap || new WeakMap();
    // We must modify mutations directly, cannot make copy and then modify
    // 注意：下一个微任务执行前的所有遗留未处理的记录；这里清空了变更记录，所有回调微任务没有执行
     let records = Array.from(this.observer.takeRecords());
    // Array.push currently seems to be implemented by a non-tail recursive function
    // so we cannot just mutations.push.apply(mutations, this.observer.takeRecords());
    while (records.length > 0) {
      mutations.push(records.pop());
    }
    // 将变动的dom 保存起来
    const mark = (blot: Blot | null, markParent = true): void => {
      if (blot == null || blot === this) {
        return;
      }
      if (blot.domNode.parentNode == null) {
        return;
      }
      if (!mutationsMap.has(blot.domNode)) {
        mutationsMap.set(blot.domNode, []);
      }
      if (markParent) {
        mark(blot.parent);
      }
    };
    const optimize = (blot: Blot): void => {
      // Post-order traversal
      if (!mutationsMap.has(blot.domNode)) {
        return;
      }
      if (blot instanceof ParentBlot) {
        blot.children.forEach(optimize);// 递归
      }
      mutationsMap.delete(blot.domNode);
      blot.optimize(context); // 实现blot的实例化
    };
    let remaining = mutations;
    /**
     * var array = [0] 
        for(var i=0; array.length>0; i++) {
          console.log(i, 'i')
            if (i ==2) { array = []} else { array = [i]}

        }
        注意这个的循环
    */
    for (let i = 0; remaining.length > 0; i += 1) {
      if (i >= MAX_OPTIMIZE_ITERATIONS) {
        throw new Error('[Parchment] Maximum optimize iterations reached');
      }
      remaining.forEach((mutation: MutationRecord) => {
        // 通过domNode 查找对应的blot 实例
        const blot = this.find(mutation.target, true);
        if (blot == null) {
          return;
        }
        if (blot.domNode === mutation.target) {
          // 节点信息改动
          if (mutation.type === 'childList') {
            mark(this.find(mutation.previousSibling, false));
            Array.from(mutation.addedNodes).forEach((node: Node) => {
              const child = this.find(node, false);
              mark(child, false);
              if (child instanceof ParentBlot) { // 只有继承了ParentBlot 的blot 才有 children, 所有的blot 都有pre和next字段
                child.children.forEach((grandChild: Blot) => {
                  mark(grandChild, false);
                });
              }
            });
          } else if (mutation.type === 'attributes') {
            mark(blot.prev);
          }
        }
        mark(blot);
      });
      // 链表的foreach， 子节点的blot 实例化
      this.children.forEach(optimize); //div-> p -> br
      // 子节点添加变化继收集
      remaining = Array.from(this.observer.takeRecords());
      // 复制数组
      records = remaining.slice();
      while (records.length > 0) {
        mutations.push(records.pop());
      }
    }
  }
  // 真实dom 加载完成后，监听到dom、属性、文本变化；
  public update(
    mutations?: MutationRecord[],
    context: { [key: string]: any } = {},
  ): void {
    mutations = mutations || this.observer.takeRecords(); // 手动控制何时检索和处理DOM变化,不依赖observer 回调
    const mutationsMap = new WeakMap();

    /*
    * map 先聚合dom 的 mutation, 然后dom 对应的blot; foreach 遍历blot ，将每个blot 调用各自update 方法;
    * 1、更新blot 结构
    * 2、optimize 通过blot 更新dom
    */ 
    mutations
      .map((mutation: MutationRecord) => {
        // 通过改动的dom ,找到domNode 关联的blot实例
        const blot = this.find(mutation.target, true); // 通过domNode.parentNode, 查找对应父节点的blot实例
        if (blot == null) {
          return null;
        }
        if (mutationsMap.has(blot.domNode)) {
          mutationsMap.get(blot.domNode).push(mutation);
          return null;
        } else {
          mutationsMap.set(blot.domNode, [mutation]);
          return blot;
        }
      })
      .forEach((blot: Blot | null) => {  // [Block, null, null]
        // 此处this 指向undefined
        if (blot != null && blot !== this && mutationsMap.has(blot.domNode)) {
          // 如果是blok,  先调用 parent.ts，只处理type 为 childNodes类型 ，然后调用继承的blokBlot 的update 方法，添加属性
          blot.update(mutationsMap.get(blot.domNode) || [], context);
        }
      });
    context.mutationsMap = mutationsMap;
    if (mutationsMap.has(this.domNode)) {
      super.update(mutationsMap.get(this.domNode), context);
    }
    
    this.optimize(mutations, context);
  }
}

export default ScrollBlot;
