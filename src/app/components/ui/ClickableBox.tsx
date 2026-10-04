import React, { useRef } from "react";
import { Box, type BoxProps, type DOMElement } from "ink";
import { useClick } from "../../mouse/useMouse";

/** A Box that reports left clicks inside it as (row, col) relative to itself. */
export const ClickableBox: React.FC<BoxProps & { onClick: (row: number, col: number) => void; children?: React.ReactNode }> = ({
  onClick,
  children,
  ...boxProps
}) => {
  const ref = useRef<DOMElement>(null);
  useClick(ref, onClick);
  return (
    <Box ref={ref} {...boxProps}>
      {children}
    </Box>
  );
};
