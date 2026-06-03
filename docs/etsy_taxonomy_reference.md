# Etsy Taxonomy & Category Attributes Reference

This document contains the definitive list of category-specific attributes supported on Etsy for each digital and crossover category in **Workstation V2**. These values were retrieved directly from the live Etsy Seller Taxonomy API (`GET /v3/application/seller-taxonomy/nodes/{id}/properties`).

---

## 1. Category Mapping & ID Reference

| Category Name (UI) | Etsy Taxonomy Node ID | Branch / Path |
| :--- | :--- | :--- |
| **Store Graphics** | `769` | Store Graphics |
| **Digital Prints / Wall Art** | `2078` | Art & Collectibles > Prints > Digital Prints |
| **Digital Planners** | `354` | Paper & Party Supplies > Paper > Calendars & Planners |
| **Templates** | `1874` | Paper & Party Supplies > Paper > Stationery > Design & Templates |
| **Clip Art** | `7663` | Craft Supplies & Tools > Digital > Clip Art |
| **Digital Patterns** | `7192` | Craft Supplies & Tools > Patterns & Blueprints > Digital Patterns |
| **Fonts** | `10620` | Craft Supplies & Tools > Digital > Fonts |
| **Logos & Branding** | `1877` | Paper & Party Supplies > Paper > Stationery > Design & Templates > Logos & Branding |
| **Social Media Templates** | `12486` | Paper & Party Supplies > Paper > Stationery > Design & Templates > Social Media Templates |
| **Website Templates** | `2818` | Paper & Party Supplies > Paper > Stationery > Design & Templates > Website Templates |
| **Digital Paper** | `1251` | Craft Supplies & Tools > Paper Craft Supplies > Digital Paper |
| **SVG Files** | `7663` | Craft Supplies & Tools > Digital > SVG Files (Shares ID with Clip Art) |
| **Lightroom Presets** | `12107` | Craft Supplies & Tools > Digital > Lightroom Presets |

---

## 2. Definitive Attribute Support Breakdown

### Group A: Categories Supporting ZERO Attributes (`NONE`)
Etsy does not accept any structured taxonomy attributes (color, occasion, etc.) for these nodes. All details must go in the listing description/tags.
* **Clip Art** (ID: `7663` / `6844` under some contexts)
* **Digital Patterns** (ID: `7192`)
* **Fonts** (ID: `10620`)
* **Social Media Templates** (ID: `12486`)
* **Lightroom Presets** (ID: `12107`)

### Group B: Core Listing Attributes Only
These categories support basic color and event tags.
* **Store Graphics** (ID: `769`)
* **Templates** (ID: `1874`)
* **Logos & Branding** (ID: `1877`)
* **Website Templates** (ID: `2818`)
* **Digital Paper** (ID: `1251`)

**Accepted Attributes:**
1. **Primary color** (ID: `200`)
2. **Secondary color** (ID: `52047899002`)
3. **Occasion** (ID: `46803063641`)
4. **Holiday** (ID: `46803063659`) *(Celebration)*
5. **Material multi** (ID: `148789511893`) *(Only for Digital Paper)*

### Group C: Planners
* **Digital Planners** (ID: `354`):
  * **Accepted Attributes:** `Primary color`, `Secondary color`, `Material multi`, `Occasion`. *(Note: **Holiday** is NOT supported here)*

### Group D: Crossover & Digital Prints (Full Schema)
This is the only category that supports deep dimensions and layout attributes.
* **Digital Prints / Wall Art** (ID: `2078`):
  * `Primary color` (ID: `200`)
  * `Secondary color` (ID: `52047899002`)
  * `Orientation` (ID: `406291158455`) *(Horizontal, Vertical, Square)*
  * `Framing` (ID: `145330288558`) *(Framed, Unframed)*
  * `Aspect ratio` (ID: `570246213622`)
  * `Room` (ID: `145330288592`) *(Nursery, Bedroom, Living room, Kitchen, Office, etc.)*
  * `Art subject` (ID: `400394338806`) *(Abstract, Animal, Flowers, Landscape, Typography, etc.)*
  * `Occasion` (ID: `46803063641`)
  * `Holiday` (ID: `46803063659`)
  * `Width` (ID: `47626759898`)
  * `Height` (ID: `47626759834`)
  * `Depth` (ID: `54142602037`)
  * `Material multi` (ID: `148789511893`)
  * `Can be personalized` (ID: `148789511775`)

---

## 3. Future Implementation Guide (Option 1)

When adding secondary colors, materials, or orientation columns to the grid:

1. **Add Columns:** Register them in the `COLUMNS` list in `src/components/SpreadsheetGrid.tsx`.
2. **Define Category Support Rules:** Add helper functions in `etsyConstants.ts` to toggle visibility (e.g., `categorySupportsOrientation`).
3. **Grey-Out Behavior:** Use the `getCellContent` callback to return a disabled read-only cell if the category is unsupported:
   ```typescript
   if (!categorySupportsOrientation(dataRow.category)) {
     return {
       kind: GridCellKind.Text,
       allowOverlay: false,
       readonly: true,
       data: "",
       displayData: "",
       themeOverride: { bgCell: "#fafafa" }
     };
   }
   ```
4. **API Integration:** Map the values into the `propertyUpdates` array in `src/app/api/etsy/push/route.ts` using the corresponding Property IDs listed above.
