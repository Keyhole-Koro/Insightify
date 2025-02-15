export interface RGBAColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export const Colors = {
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    gray: { r: 128, g: 128, b: 128 },
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
};

export function rgb(color: RGBAColor): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function rgba(color: RGBAColor): string {
    const alpha = color.a !== undefined ? color.a : 1;
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export function transparent(): RGBAColor {
    return { r: 0, g: 0, b: 0, a: 0 }; // Return a fully transparent color
}
