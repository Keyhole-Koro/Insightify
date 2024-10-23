import { BaseItemClass } from '@base/base-item';

class ItemManager {
  private items: BaseItemClass[] = [];

  addItem(item: BaseItemClass): void {
    this.items.push(item);
  }

  removeItem(item: BaseItemClass): void {
    this.items = this.items.filter(i => i !== item);
  }

  getItemByIndex(index: number): BaseItemClass {
    return this.items[index];
  }

  updateItemPosition(id: number, x: number, y: number): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.setPosition(x, y);
    }
  }

  bringItemToFront(item: BaseItemClass): void {
    this.items = this.items.filter(i => i !== item);
    this.items.push(item); // Move item to the end
  }

  renderAll(): JSX.Element[] {
    return this.items.map(item => item.render());
  }

  checkCollision(item1: BaseItemClass, item2: BaseItemClass): boolean {
    const rect1 = { x: item1.x, y: item1.y, width: item1.width, height: item1.height };
    const rect2 = { x: item2.x, y: item2.y, width: item2.width, height: item2.height };

    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  getCollidingItem(item: BaseItemClass): BaseItemClass | null {
    for (const i of this.items) {
      if (i !== item && this.checkCollision(item, i)) {
        return i;
      }
    }
    return null;
  }
}

export default ItemManager;