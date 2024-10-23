import Attributor from './attributor.js';

// 将给定的字符串从连字符分隔的格式转换为驼峰格式。
function camelize(name: string): string { // 'font-size'
  const parts = name.split('-'); // ['font', 'size]
  const rest = parts
    .slice(1)
    .map((part: string) => part[0].toUpperCase() + part.slice(1))
    .join(''); // ['Size']
  return parts[0] + rest; // fontSize
}

class StyleAttributor extends Attributor {
  
public static keys(node: HTMLElement): string[] {
    return (node.getAttribute('style') || '').split(';').map((value) => {
      const arr = value.split(':');
      return arr[0].trim();
    });
  }

  public add(node: HTMLElement, value: any): boolean {
    if (!this.canAdd(node, value)) {
      return false;
    }
    // @ts-expect-error Fix me later
    node.style[camelize(this.keyName)] = value;
    return true;
  }

  public remove(node: HTMLElement): void {
    // @ts-expect-error Fix me later
    node.style[camelize(this.keyName)] = '';
    if (!node.getAttribute('style')) {
      node.removeAttribute('style');
    }
  }

  public value(node: HTMLElement): any {
    // @ts-expect-error Fix me later
    const value = node.style[camelize(this.keyName)];
    return this.canAdd(node, value) ? value : '';
  }
}

export default StyleAttributor;
