import { BaseItem } from '@item/base-item';

class ItemManager {
  private items: BaseItem[] = [];

  addItem(item: BaseItem): void {
    this.items.push(item);
  }

  removeItem(item: BaseItem): void {
    this.items = this.items.filter(i => i !== item);
  }

  getItemByIndex(index: number): BaseItem {
    return this.items[index];
  }

  updateItemPosition(id: number, x: number, y: number): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.setPosition(x, y);
    }
  }

  bringItemToFront(item: BaseItem): void {
    this.items = this.items.filter(i => i !== item);
    this.items.push(item); // Move item to the end
  }

  renderAll(): JSX.Element[] {
    return this.items.map(item => item.render());
  }
}

export default ItemManager;
