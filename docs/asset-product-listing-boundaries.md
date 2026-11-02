# Assets, products, and channel listings

## Decision

Keep three records with separate ownership. The common library/detail/preview layout can be reused, but sharing a layout must not make their data interchangeable.

| Record | Owns | Where it is edited |
| --- | --- | --- |
| Imported asset folder | Original Etsy URL and ID, source title, description, tags, materials, imported images | Import/fetch pipeline; displayed read-only in Assets |
| Workspace product | Internal name, production artwork, mockup recipe, rendered views, gallery order, source provenance | Design, Mockups, and Products |
| Channel listing | Channel title, description, tags or keywords, pricing, shipping, status, remote identifiers | Etsy or Amazon worksheet |

One source can inspire several products. A product can have independent Etsy and Amazon listing drafts. The current worksheet merge matches a product ID within a worksheet; multiple listings for the same product in the same worksheet would require an explicit listing identity and selection flow before changing that behavior.

## What travels today

1. Assets → Design passes the chosen image URL and a display name. The design workflow retains `sourceAssetUrl` on prepared artwork.
2. Design → Mockups → Products saves artwork, the selected mockup recipe, generated media, and the source image URL under product origin.
3. Products → channel worksheet explicitly prepares a listing, supplying product ID, revision, selected gallery images, artwork, and preset defaults.
4. Subsequent preparation updates product media and revision while preserving the worksheet's listing copy, prices, and remote IDs. Publishing remains a separate channel action.

Imported listing copy is reference material. Showing it on another tab does not copy it into a product or channel listing. The Agent may read source details as inspiration when writing original copy, but source price/materials are not confirmed facts about the user's product.

## UI implemented

- Assets uses one searchable library with a completeness filter. Cards show the source image, title, image count, and details status. Bulk-selection controls appear on request. Search includes title, listing ID, and tags.
- Asset detail has a back link and Previous/Next navigation within the current search/filter results. A selected-image preview, thumbnail strip, and Use image in Design action sit beside one information panel on wider views and stack on narrower views. Long descriptions expand on demand, with tags and copy actions grouped underneath. Image import history is a secondary disclosure.
- Products with source provenance have an expandable Source reference panel. It resolves the original image through saved image imports and uses the same read-only source-information component. No source data is duplicated into product persistence.
- Missing values are reported as missing. No background Etsy fetch or AI generation is triggered by viewing these panels.
- Source details show the latest saved folder-level information. Existing import versions preserve images only; they are not historical text snapshots.

## Further architecture work

The current product reference is an image URL, not a dedicated asset identity. Before supporting multiple reference sources, source-level notes, or channel reference sidebars, add a structured reference containing asset ID and import ID alongside the existing URL, with migration for existing products. If reproducible generation is needed, save a reference snapshot or metadata revision with the generation action; a live reference can change after a fetch.

Reuse `SourceListingDetails` for future channel reference sidebars, with a separately labelled channel editor. Any action that uses source text to create listing copy should target a selected channel draft, preview the proposed changes, validate that channel's constraints, and preserve existing edits unless the user requests replacement.

Products now uses product terminology throughout its library, creation, and deletion flows. Product detail separates Artwork & Mockups, Source Reference, and Channel Listings. Library cards show linked channel statuses. Channel cards distinguish creating a draft, opening an existing worksheet row, and updating draft images. Image freshness compares the selected image URLs and order, not the product revision (which also changes for renames). Existing image refreshes need no preset and preserve listing copy, pricing, and identity. A refresh request cannot silently create a replacement if the original draft has been removed. Remote updates and publishing remain separate worksheet actions.

Marketplace-specific copy remains in worksheets for now. A future shared product brief should contain confirmed product facts and writing direction, rather than a single title/description/tags object that every channel silently shares.
