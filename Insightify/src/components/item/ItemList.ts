import React from 'react';
import { Circle, Anchor, Rectangle, TextInput } from './low-level/items';
import { BaseItemClass, BaseItemProps, BaseItemState } from './base/base/base-item';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface ItemList {
    category: string;
    items: BaseItemClass[];
}

// Path to the low-level/items.ts file
const filePath = path.join(__dirname, 'low-level/items.ts');

// Read the file content
const fileContent = fs.readFileSync(filePath, 'utf8');

// Parse the file content
const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

// Function to find classes that inherit from BaseItemClass
function findClassesInheritingBaseItemClass(node: ts.Node): string[] {
    const classes: string[] = [];

    function visit(node: ts.Node) {
        if (ts.isClassDeclaration(node) && node.heritageClauses) {
            node.heritageClauses.forEach(clause => {
                clause.types.forEach(type => {
                    if (type.expression.getText() === 'BaseItemClass') {
                        if (node.name) {
                            classes.push(node.name.getText());
                        }
                    }
                });
            });
        }
        ts.forEachChild(node, visit);
    }

    visit(node);
    return classes;
}

// Find and list the classes
const classes = findClassesInheritingBaseItemClass(sourceFile);
console.log('Classes inheriting from BaseItemClass:', classes);