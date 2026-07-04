import React from "react";
import { Box, Text } from "ink";
import { palette, glyph } from "../theme";
import type { AppState } from "../types";

export const ToastContainer: React.FC<{ toasts: AppState["toasts"] }> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <Box position="absolute" top={1} right={2} flexDirection="column" alignItems="flex-end">
      {toasts.map((toast) => {
        let color: string = palette.info;
        let symbol: string = glyph.dot;
        if (toast.type === "success") {
          color = palette.ok;
          symbol = glyph.check;
        } else if (toast.type === "error") {
          color = palette.danger;
          symbol = glyph.cross;
        }

        return (
          <Box
            key={toast.id}
            borderStyle="single"
            borderColor={color}
            paddingX={1}
            marginBottom={1}
            flexDirection="row"
          >
            <Text color={color} bold>
              {symbol}{" "}
            </Text>
            <Text color={palette.textBright}>{toast.message}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
