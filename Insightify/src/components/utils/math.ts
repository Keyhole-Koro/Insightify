export interface Point {
    x: number;
    y: number;
}

export const angle = (deltaX: number, deltaY: number) => {
    return (Math.atan2(deltaY, deltaX) * (180 / Math.PI)) % 360 + 180;
}

export const sigmoid = (x: number): number => {
    return 1 / (1 + Math.exp(-x));
};

export const magnitude = (deltaX: number, deltaY: number): number => {
    return Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
}