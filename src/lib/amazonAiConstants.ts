export const AMAZON_AI_DROPDOWN_OPTIONS = {
  neck_style: ["Crew Neck", "V-Neck", "Round Neck", "Boat Neck", "Halter Neck", "High Neck", "Hooded Neck", "Mock Neck", "Turtle Neck", "Square Neck", "Off Shoulder Neck", "Asymmetric Neck"],
  collar_style: ["Collarless", "Button-Down", "Spread", "Mandarin", "Polo"],
  sleeve_type: ["Balloon Sleeve", "Batwing Sleeve", "Bell Sleeve", "Bishop Sleeve", "Butterfly Sleeve", "Cap Sleeve", "Cape Sleeve", "Cold Shoulder Sleeve", "Cuff Sleeve", "Dolman Sleeve", "Flutter Sleeve", "Gathered Sleeve", "Kimono Sleeve", "Lantern Sleeve", "Long Sleeve", "Puff Sleeve", "Raglan Sleeve", "Roll Up Sleeve", "Short Sleeve", "Sleeveless", "Slit Sleeve", "Strapless"],
  sleeve_length: ["3/4 Sleeve", "Bracelet Sleeve", "Half Sleeve", "Long Sleeve", "Short Sleeve", "Sleeveless"],
  sleeve_cuff: ["Rolled", "Open", "Ribbed Cuff", "Barrel Cuff", "French Cuff", "Single Cuff"],
  top_style: ["A-Line", "Asymmetric", "Blouson", "Boxy", "Bralette", "Bustier", "Camisole", "Cape", "Hooded", "Kaftan", "Layered", "Peplum", "Poncho", "Pullover", "Tube", "Wrap"],
  shirt_form_type: ["T-Shirt", "Button-Down", "Polo", "Henley", "Tank Top"],
  closure_type: ["Button", "Zipper", "Snap", "Pull On", "Drawstring", "Hook and Eye", "Hook and Loop", "Buckle"],
  apparel_fabric_stretch: ["high_stretch", "low_stretch", "medium_stretch", "no_stretch"],
  apparel_fabric_weight_class: ["heavyweight", "lightweight", "medium_weight"],
  fabric_stretchability: ["stretchable", "non_stretchable"],
  special_features: ["Moisture Wicking", "Lightweight", "Breathable", "Water Resistant", "Quick Dry"],
  pattern: ["Floral", "Solid", "Striped", "Plaid", "Polka Dot", "Geometric", "Animal Print"],
  theme: ["Animals", "Sports", "Music", "Movies", "Holidays", "Nature", "Space"],
  subject_character: ["Batman", "Superman", "Spider-Man", "Mickey Mouse", "Harry Potter", "Star Wars"],
  animal_theme: ["Alpaca", "Cat", "Dog", "Dinosaur", "Bear", "Lion", "Tiger"],
  pocket_description: ["Basic-5-Pocket", "Slant", "Flap", "Patch", "Cargo", "No Pocket"],
  number_of_pockets: ["1", "2", "3", "4", "5", "6"],
  fashion_decade: ["1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"],
  seasons: ["Summer", "Spring", "Winter", "Autumn", "All-Season"],
  embellishment_feature: ["Buckle", "Applique", "Embroidery", "Lace", "Sequin", "Beaded", "Ruffle"],
  target_gender: ["unisex", "female", "male"],
  age_range_description: ["adult", "teen", "child", "infant"],
  department_name: ["women", "men", "unisex-adult", "girls", "boys"],
  care_instructions: ["Machine Wash", "Hand Wash", "Dry Clean Only", "Do Not Wash", "Line Dry"]
} as const;

export type AmazonAiDropdownField = keyof typeof AMAZON_AI_DROPDOWN_OPTIONS;

export const AMAZON_AI_TEXT_FIELDS = ["bullet_points", "keywords"] as const;
export type AmazonAiTextField = typeof AMAZON_AI_TEXT_FIELDS[number];
