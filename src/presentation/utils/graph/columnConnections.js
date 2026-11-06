export const columnConnectionPath = (source, target) => {
  const sourceY = source.y + source.height / 2;
  const targetY = target.y + target.height / 2;
  const sameColumn = source.x === target.x;
  const forward = target.x > source.x;
  const sourceX = sameColumn || forward ? source.x + source.width : source.x;
  const targetX = sameColumn || !forward ? target.x + target.width : target.x;

  if (sameColumn) {
    const lane = Math.max(sourceX, targetX) + 12;
    return `M ${sourceX} ${sourceY} C ${lane} ${sourceY}, ${lane} ${targetY}, ${targetX} ${targetY}`;
  }
  if (Math.abs(target.column - source.column) === 1) {
    const middle = (sourceX + targetX) / 2;
    return `M ${sourceX} ${sourceY} C ${middle} ${sourceY}, ${middle} ${targetY}, ${targetX} ${targetY}`;
  }
  // Skipped columns are routed above the lists rather than through their text.
  const sourceLane = sourceX + (forward ? 12 : -12);
  const targetLane = targetX + (forward ? -12 : 12);
  return `M ${sourceX} ${sourceY} H ${sourceLane} V 12 H ${targetLane} V ${targetY} H ${targetX}`;
};
