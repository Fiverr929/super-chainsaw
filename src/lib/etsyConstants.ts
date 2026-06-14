export const ETSY_DIGITAL_CATEGORIES = ["", "Store Graphics", "Digital Prints", "Digital Planners", "Templates", "Clip Art", "Wall Art", "Digital Patterns", "Fonts", "Logos & Branding", "Social Media Templates", "Website Templates", "Digital Paper", "SVG Files", "Lightroom Presets"];

export const ETSY_PHYSICAL_CATEGORIES = ["", "T-Shirts", "Sweatshirts & Hoodies", "Mugs & Drinkware", "Stickers & Decals", "Posters & Prints", "Tote Bags", "Hats & Caps"];

export const ETSY_WHEN_MADE = ["made_to_order", "2020_2026", "2010_2019", "2007_2009", "before_2007", "2000_2006", "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900_1909", "1800s", "1700s", "before_1700"];

export const ETSY_SUBJECTS = ["Auto", "None", "Abstract & geometric", "Animal", "Anime & cartoon", "Architecture & cityscape", "Beach & tropical", "Comics & manga", "Educational", "Fantasy & Sci Fi", "Fashion", "Flowers", "Food & drink", "Horror & gothic", "Humorous saying", "Inspirational saying", "Landscape & scenery", "Love & friendship", "Movie", "Music", "Nautical", "People & portrait", "Pet portrait", "Phrase & saying", "Plants & trees", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Travel & transportation", "TV", "Typography & symbols", "Video game", "Western & cowboy", "Zodiac"];

export const ETSY_SECTIONS = ["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"];

export const ETSY_COLORS = ["Auto", "None", "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow"];

export const ETSY_OCCASIONS = ["Auto", "None", "1st birthday", "Anniversary", "Baby shower", "Back to school", "Baptism", "Bar & Bat Mitzvah", "Birthday", "Bridal shower", "Confirmation", "Divorce & breakup", "Engagement", "First Communion", "Graduation", "Grief & mourning", "House warming", "LGBTQ pride", "Moving", "Pet loss", "Retirement", "Wedding"];

export const ETSY_CELEBRATIONS = ["Auto", "None", "Christmas", "Cinco de Mayo", "Easter", "Eid", "Father's Day", "Halloween", "Hanukkah", "Holi", "Independence Day", "Kwanzaa", "Lunar New Year", "Mother's Day", "New Year's", "Passover", "Ramadan", "St Patrick's Day", "Thanksgiving", "Valentine's Day", "Veterans Day"];

export const ETSY_STATUSES = ["Draft", "Generating...", "Review", "Pushing...", "Published", "Error"];

export const categorySupportsOccasion = (cat: string) => {
  if (!cat) return true;
  return !["Clip Art", "Digital Patterns", "Fonts", "Lightroom Presets", "Social Media Templates", "SVG Files"].includes(cat);
};

export const categorySupportsCelebration = (cat: string) => {
  if (!cat) return true;
  if (cat === "Digital Planners") return false;
  return categorySupportsOccasion(cat);
};

export const categorySupportsSubject = (cat: string) => {
  return ["Digital Prints", "Wall Art", "Posters & Prints"].includes(cat);
};
export const ETSY_SECONDARY_COLORS = ETSY_COLORS;

export const ETSY_ORIENTATION = ["Auto", "None", "Horizontal", "Vertical", "Square", "Round"];

export const ETSY_FRAMING = ["Auto", "None", "Framed", "Unframed"];

export const ETSY_ASPECT_RATIO = ["Auto", "None", "1:1", "1:2", "2:3", "3:4", "4:5", "5:7 (ISO ratio)", "11:14", "16:9"];

export const ETSY_ROOM = ["Auto", "None", "Bathroom", "Bedroom", "Dorm", "Entryway", "Game room", "Kids", "Kitchen & dining", "Laundry", "Living room", "Nursery", "Office"];

export const ETSY_HOME_STYLE = ["Auto", "None", "Art deco", "Art nouveau", "Bohemian & eclectic", "Coastal & tropical", "Contemporary", "Country & farmhouse", "Gothic", "Industrial & utility", "Lodge", "Mid-century", "Minimalist", "Rustic & primitive", "Southwestern", "Victorian"];

export const ETSY_CAN_BE_PERSONALIZED = ["Auto", "None", "Yes", "No"];

export const ETSY_SLEEVE_LENGTH = ["Auto", "None", "Short sleeve", "Long sleeve", "Sleeveless", "3/4 sleeve", "Half sleeve"];

export const ETSY_NECKLINE = ["Auto", "None", "Crew neck", "V-neck", "Hooded", "Collared", "Off the shoulder", "Scoop neck"];

export const ETSY_CLOTHING_STYLE = ["Auto", "None", "Athletic", "Casual", "Goth", "Minimalist", "Retro", "Streetwear"];

export const ETSY_MUG_CAPACITY = ["Auto", "None", "11 oz", "15 oz", "20 oz", "30 oz"];
export const categorySupportsGraphic = (cat: string) => {
  return ["T-Shirts", "Sweatshirts & Hoodies", "Mugs & Drinkware"].includes(cat);
};

export const ETSY_GRAPHICS = [
  "Auto", "None",
  "Abstract & geometric", "Animal", "Anime & cartoon", "Beach & tropical", "Bollywood", 
  "Brand & logo", "Comics & manga", "Fantasy & Sci Fi", "Fitspiration", "Flowers", 
  "Food & drink", "Geography & locale", "Horror & gothic", "Humorous saying", 
  "Inspirational saying", "LGBTQ pride", "Literary", "Love & friendship", 
  "Military & historical", "Movie", "Music", "Nautical", "Patriotic & flags", 
  "Phrase & saying", "Plants & trees", "Politics & elections", "Protest", 
  "Punk & tattoos", "Religious", "Science & tech", "Sports & fitness", 
  "Stars & celestial", "Steampunk", "Superhero", "Surf & skate", 
  "Travel & transportation", "TV", "Video game", "Western & cowboy", "Zodiac"
];

export type VariationPropertyDef = {
  name: string;
  propertyId: number;
  options: string[];
};

export const ETSY_VARIATION_PROPERTY_DEFS: Record<string, VariationPropertyDef[]> = {
  "T-Shirts": [
    { name: "Size", propertyId: 513, options: ["S", "M", "L", "XL", "2XL", "3XL"] },
    { name: "Primary color", propertyId: 200, options: ["Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow"] }
  ],
  "Sweatshirts & Hoodies": [
    { name: "Size", propertyId: 513, options: ["S", "M", "L", "XL", "2XL", "3XL"] },
    { name: "Primary color", propertyId: 200, options: ["Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow"] }
  ],
  "Mugs & Drinkware": [
    { name: "Capacity", propertyId: 52047898162, options: ["11 oz", "15 oz", "20 oz", "30 oz"] }
  ],
  "Posters & Prints": [
    { name: "Size", propertyId: 513, options: ["8x10", "11x14", "12x16", "16x20", "18x24", "24x36"] }
  ]
};
