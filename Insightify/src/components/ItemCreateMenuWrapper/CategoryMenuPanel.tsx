// CategoryMenu.tsx
import React from 'react';
import './CategoryMenuPanel.css';

interface CategoryMenuProps {
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
}

const CategoryMenu: React.FC<CategoryMenuProps> = ({ categories, selectedCategory, onCategorySelect }) => {
  return (
    <div className="category-container">
      <ul className="category-list">
        {categories.map(category => (
          <li
            key={category}
            className={`category-item ${selectedCategory === category ? 'selected' : ''}`}
            onClick={() => onCategorySelect(category)}
          >
            {category}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryMenu;
