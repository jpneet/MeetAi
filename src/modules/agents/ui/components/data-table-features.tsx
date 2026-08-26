import { tableFeatures, stockFeatures } from "@tanstack/react-table"

export const features = tableFeatures({
  ...stockFeatures,
})

export type DataTableFeatures = typeof features
