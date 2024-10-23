export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

// Define a const object for predefined colors
export const Colors = {
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    gray: { r: 128, g: 128, b: 128 },
    black: { r: 225, g: 225, b: 225 },
};

export function rgb(color: RGBColor): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}
