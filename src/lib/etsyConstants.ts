export const ETSY_TAXONOMY_MAP: Record<string, number> = {
  "Store Graphics": 769,
  "Digital Prints": 2078,
  "Digital Planners": 354,
  "Templates": 1874,
  "Clip Art": 7663,
  "Wall Art": 2078,
  "Digital Patterns": 7192,
  "Fonts": 10620,
  "Logos & Branding": 1877,
  "Social Media Templates": 12486,
  "Website Templates": 2818,
  "Digital Paper": 1251,
  "SVG Files": 7663,
  "Lightroom Presets": 12107
};

export const ETSY_CATEGORIES = Object.keys(ETSY_TAXONOMY_MAP);

export const ETSY_WHEN_MADE = ["made_to_order", "2020_2026", "2010_2019", "2007_2009", "before_2007", "2000_2006", "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900_1909", "1800s", "1700s", "before_1700"];

export const ETSY_SUBJECTS = ["", "Abstract & geometric", "Animal", "Anime & cartoon", "Architecture & cityscape", "Beach & tropical", "Comics & manga", "Educational", "Fantasy & Sci Fi", "Fashion", "Flowers", "Food & drink", "Horror & gothic", "Humorous saying", "Inspirational saying", "Landscape & scenery", "Love & friendship", "Movie", "Music", "Nautical", "People & portrait", "Pet portrait", "Phrase & saying", "Plants & trees", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Travel & transportation", "TV", "Typography & symbols", "Video game", "Western & cowboy", "Zodiac"];

export const ETSY_SECTIONS = ["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"];

export const ETSY_COLORS = ["", "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Red", "Rose gold", "Silver", "White", "Yellow"];

export const ETSY_OCCASIONS = ["", "1st birthday", "Anniversary", "Baby shower", "Back to school", "Baptism", "Bar & Bat Mitzvah", "Birthday", "Bridal shower", "Confirmation", "Divorce & breakup", "Engagement", "First Communion", "Graduation", "Grief & mourning", "House warming", "LGBTQ pride", "Moving", "Pet loss", "Retirement", "Wedding"];

export const ETSY_CELEBRATIONS = ["", "Christmas", "Cinco de Mayo", "Easter", "Eid", "Father's Day", "Halloween", "Hanukkah", "Holi", "Independence Day", "Kwanzaa", "Lunar New Year", "Mother's Day", "New Year's", "Passover", "Ramadan", "St Patrick's Day", "Thanksgiving", "Valentine's Day", "Veterans Day"];

export const ETSY_STATUSES = ["Draft", "Generate AI", "Generating...", "Review", "Ready to Push", "Update Text & SEO", "Update Images", "Update Digital Files", "Pushing...", "Published", "Error"];

export const categorySupportsOccasion = (cat: string) => {
  if (!cat) return true;
  return !["Clip Art", "Digital Patterns", "Fonts", "Digital Paper", "SVG Files", "Lightroom Presets"].includes(cat);
};

export const categorySupportsCelebration = (cat: string) => {
  if (!cat) return true;
  if (cat === "Digital Planners") return false;
  return categorySupportsOccasion(cat);
};

export const categorySupportsSubject = (cat: string) => {
  return ["Digital Prints", "Wall Art"].includes(cat);
};
