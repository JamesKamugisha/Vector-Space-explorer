import type { RealDocument } from "./types";

/** Authored sample text, not images, user uploads, or a model training dataset.
 * Each passage combines one factual subject with a distinct practical context.
 * Interleaving keeps all six topics represented as the visible prefix grows. */
type Topic = {
  name: string;
  color: string;
  facts: [string, string][];
  contexts: [string, string][];
};
const topics: Topic[] = [
  {
    name: "Cats",
    color: "#ff756f",
    facts: [
      [
        "Tail communication",
        "A cat holding its tail upright often signals a friendly approach. A lashing tail can indicate agitation, so tail movement should be read together with posture and ears.",
      ],
      [
        "Whisker sensing",
        "Cat whiskers are sensitive touch structures that help an animal detect nearby surfaces. Their position can also change as the cat investigates an unfamiliar object.",
      ],
      [
        "Scratching surfaces",
        "Cats scratch to maintain their claws, stretch, and leave visual and scent signals. A stable scratching post gives this normal behavior a suitable surface.",
      ],
      [
        "Quiet hiding places",
        "A hiding place lets a cat choose when to leave a stressful situation. Covered beds and accessible boxes can offer a retreat without forcing interaction.",
      ],
      [
        "Play and hunting",
        "Stalking, chasing, and pouncing are parts of feline hunting behavior. Wand toys can provide supervised opportunities to practice these movements away from hands.",
      ],
      [
        "Litter box location",
        "Cats benefit from a clean litter tray in a quiet, accessible location. An abrupt change in elimination behavior can have several causes and deserves attention.",
      ],
      [
        "Purring and context",
        "Cats may purr during comfortable social contact, but purring is not proof that a cat is relaxed. Body posture and the surrounding situation provide important context.",
      ],
      [
        "Grooming routines",
        "A cat uses its tongue to groom its coat. Gentle brushing can help remove loose fur, especially for long-haired cats that have difficulty keeping their coats free of tangles.",
      ],
      [
        "Introducing new cats",
        "Introducing unfamiliar cats gradually allows them to investigate smells before close contact. Separate resources and controlled meetings can reduce competition over resting places and food.",
      ],
      [
        "Vertical territory",
        "Shelves and stable climbing structures add vertical space for cats. Elevated resting spots give a cat more choices about observing activity from a distance.",
      ],
      [
        "Carrier familiarity",
        "Leaving a cat carrier open as a familiar resting space can make it less surprising on travel days. A washable blanket can provide a familiar scent inside.",
      ],
      [
        "Sleep patterns",
        "Cats often alternate sleep with short periods of activity. Individual routines vary with age, environment, and opportunities for play rather than following a single household schedule.",
      ],
      [
        "Food puzzles",
        "A simple food puzzle asks a cat to manipulate an object to reach part of its meal. The difficulty should allow success rather than creating frustration.",
      ],
      [
        "Cat ears and posture",
        "Forward-facing ears can accompany curiosity, while flattened ears may accompany fear or defensive behavior. No single ear position replaces observing the whole animal.",
      ],
    ],
    contexts: [
      [
        "At home",
        "In a home with a cat, provide choices about resting, approaching people, and retreating. Predictable routines help people notice changes in the animal’s usual behavior.",
      ],
      [
        "Shelter observation",
        "A shelter volunteer can record how a cat responds at a comfortable distance. Quiet observation offers more useful information than immediately reaching into the enclosure.",
      ],
      [
        "Apartment enrichment",
        "For an indoor apartment cat, enrichment can use floor space, safe elevated areas, and short supervised play sessions. Rotate activities to discover individual preferences.",
      ],
      [
        "Visitor preparation",
        "Before visitors arrive, make a quiet cat retreat accessible. Ask guests to let the animal initiate contact instead of pursuing it through the room.",
      ],
      [
        "Daily observation",
        "An owner’s short daily notes can describe a cat’s activity, appetite, and use of familiar spaces. Specific observations are more useful than assuming a single cause.",
      ],
      [
        "Multi-cat household",
        "In a household with several cats, distribute resting places and other resources. Watch individual behavior because cats sharing a home may prefer different degrees of contact.",
      ],
    ],
  },
  {
    name: "Dogs",
    color: "#ffae52",
    facts: [
      [
        "Recall training",
        "Teach a dog to come when called by rewarding successful returns in an easy setting. Increase distractions gradually and use a secure area while reliability develops.",
      ],
      [
        "Loose-leash walking",
        "Reward a dog for walking near the handler before the leash becomes tight. Short practice sessions in a quiet area can make the expected position easier to learn.",
      ],
      [
        "Scent exploration",
        "Dogs collect information by sniffing. Allowing safe sniffing opportunities during a walk can add mental activity beyond simply covering a distance.",
      ],
      [
        "Reward timing",
        "A training reward is easiest to associate with a behavior when it follows promptly. A consistent marker can identify the moment the desired action occurs.",
      ],
      [
        "Canine body language",
        "A dog’s posture, facial tension, ears, and tail should be considered together. A wagging tail alone does not prove that a dog welcomes an approaching person.",
      ],
      [
        "Settling on a mat",
        "A designated mat can become a place where a dog practices calm behavior. Begin by rewarding brief relaxed moments before extending the time or adding distractions.",
      ],
      [
        "Chewing choices",
        "Chewing is a normal canine activity. Suitable supervised chew items give a dog an alternative to household objects, with size and material chosen for the individual animal.",
      ],
      [
        "Gradual social exposure",
        "Positive social exposure lets a dog encounter people, sounds, and environments at a manageable intensity. Overwhelming a worried dog is different from building confidence gradually.",
      ],
      [
        "Retrieving games",
        "A retrieving game includes chasing, picking up, and returning an object. Teaching each part separately can help a dog that enjoys chasing but has not learned to return.",
      ],
      [
        "Rest after activity",
        "Dogs need opportunities to rest as well as exercise. A quiet resting area allows recovery and gives the dog a predictable place away from household activity.",
      ],
      [
        "Puzzle feeding",
        "A food puzzle can turn part of a dog’s meal into a searching task. Start with an easy design and supervise the dog’s use of unfamiliar equipment.",
      ],
      [
        "Greeting politely",
        "A dog can practice keeping its paws on the floor during greetings. Reward the desired posture and keep early sessions short enough for the dog to succeed.",
      ],
      [
        "Travel preparation",
        "A dog can become familiar with travel equipment before a long journey. Short positive practice sessions can introduce a secured crate or properly fitted vehicle restraint.",
      ],
      [
        "Cooperative grooming",
        "Brief grooming practice can pair handling with rewards and pauses. Watch the dog’s comfort rather than forcing a long session after it becomes distressed.",
      ],
    ],
    contexts: [
      [
        "Training session",
        "During dog training, choose one observable behavior and a clear reward. End the session while the learner is still engaged rather than repeating until frustration appears.",
      ],
      [
        "Neighborhood walk",
        "On a neighborhood dog walk, adjust the route and distance from distractions. A quieter location can make a new skill easier to practice.",
      ],
      [
        "Family routine",
        "Family members can use consistent signals with the dog and agree on the behavior they will reward. This helps avoid contradictory expectations between handlers.",
      ],
      [
        "Shelter enrichment",
        "A shelter enrichment plan can give a dog safe choices, opportunities to sniff, and calm human contact. Adapt the activity to the animal’s observed response.",
      ],
      [
        "New environment",
        "When a dog enters an unfamiliar place, allow time to observe at a comfortable distance. Familiar routines and simple successful tasks can support the transition.",
      ],
      [
        "Progress journal",
        "A dog training journal can record location, distractions, response, and reward. These details help distinguish a skill that is learned from one that still needs practice.",
      ],
    ],
  },
  {
    name: "Cars",
    color: "#68a9ff",
    facts: [
      [
        "Regenerative braking",
        "An electric car can use its traction motor as a generator while slowing down. Regenerative braking returns some energy to the battery, while friction brakes still provide necessary stopping capability.",
      ],
      [
        "Tire pressure",
        "A car’s recommended tire pressure is normally specified by the vehicle manufacturer. Pressure readings change with temperature, so cold-tire measurements give a useful consistent reference.",
      ],
      [
        "Electric charging",
        "An electric vehicle’s charging speed depends on the vehicle, charger, battery temperature, and state of charge. The maximum advertised power is not maintained throughout every charging session.",
      ],
      [
        "Aerodynamic drag",
        "Air resistance increases strongly as a car travels faster. Body shape and frontal area influence the energy needed to move air around the vehicle.",
      ],
      [
        "Hybrid powertrain",
        "A hybrid car combines an engine with an electric motor and battery. Its control system chooses how to use these components according to operating conditions.",
      ],
      [
        "Anti-lock brakes",
        "An anti-lock braking system modulates brake pressure to help prevent wheel lock. It supports steering control during hard braking but cannot create grip that the road surface does not provide.",
      ],
      [
        "Battery temperature",
        "An electric car’s battery management system monitors temperature and other operating conditions. Heating or cooling the pack can help keep it within a suitable operating range.",
      ],
      [
        "Engine cooling",
        "A liquid-cooled car engine transfers heat through coolant and a radiator. The cooling system moves excess heat away from the engine during operation.",
      ],
      [
        "Transmission ratios",
        "A transmission changes the relationship between motor speed and wheel speed. Different ratios help a combustion engine operate usefully across a range of vehicle speeds.",
      ],
      [
        "Suspension movement",
        "Springs and dampers allow a car’s wheels to move relative to its body. The suspension balances contact with the road, comfort, and control over uneven surfaces.",
      ],
      [
        "Vehicle visibility",
        "Mirrors and cameras help a driver observe the area around a car. Their coverage has limits, so a camera image is not a complete substitute for situational awareness.",
      ],
      [
        "Cabin heating",
        "Heating an electric car cabin draws energy from the battery unless another source is available. Heat pumps can move heat more efficiently than resistance heating under some conditions.",
      ],
      [
        "Rolling resistance",
        "A tire deforms as it rolls, using energy. Tire construction, pressure, load, and road conditions all contribute to rolling resistance.",
      ],
      [
        "Maintenance records",
        "A car maintenance record lists work performed, dates, and mileage. It helps an owner follow the manufacturer’s service schedule and track recurring issues.",
      ],
    ],
    contexts: [
      [
        "Driver handbook",
        "A driver handbook explains vehicle features in the context of a specific car. Check the manufacturer’s instructions because controls and capabilities differ between models.",
      ],
      [
        "Engineering comparison",
        "An engineering comparison of cars should use similar test conditions. Differences in speed, temperature, vehicle load, and route can change the results.",
      ],
      [
        "Urban commute",
        "An urban car commute includes frequent starts and stops. Traffic conditions influence energy use differently from a steady-speed highway journey.",
      ],
      [
        "Road trip planning",
        "Planning a car road trip includes route distance, rest stops, weather, and suitable charging or fueling locations. Leave flexibility for conditions that differ from expectations.",
      ],
      [
        "Workshop explanation",
        "A workshop can explain a car component by describing its purpose and how it interacts with nearby systems. Symptoms alone do not always identify the failed part.",
      ],
      [
        "Efficiency notebook",
        "A vehicle efficiency notebook can record energy use alongside weather and driving conditions. Comparing repeated trips is more informative than a single unusually favorable journey.",
      ],
    ],
  },
  {
    name: "Faces",
    color: "#63df9a",
    facts: [
      [
        "Natural portrait lighting",
        "A portrait can use a large soft light source to produce gradual facial shadows. Positioning the light and subject changes how facial contours appear without changing the person.",
      ],
      [
        "Eye-level portraits",
        "Placing a portrait camera near eye level often creates a familiar conversational viewpoint. Raising or lowering the camera changes the apparent relationships between facial features.",
      ],
      [
        "Facial expressions",
        "Facial expressions involve coordinated movement of many muscles. Interpreting an expression depends on context and should not be treated as certain knowledge of a person’s emotions.",
      ],
      [
        "Portrait focal length",
        "Camera distance strongly influences perspective in a face photograph. A longer focal length often lets a photographer keep a useful framing from farther away.",
      ],
      [
        "Catchlights",
        "A catchlight is a reflection of a light source visible in an eye. Its position and shape reveal something about the portrait lighting setup.",
      ],
      [
        "Face landmarks",
        "Facial landmarks describe locations such as eye corners and the tip of the nose. Computer vision systems can use these reference points for geometric alignment.",
      ],
      [
        "Expression variation",
        "Photographs of the same person can differ with expression, head angle, and illumination. A face image is one observation under particular conditions, not a complete description of identity.",
      ],
      [
        "Portrait backgrounds",
        "A portrait background can support or distract from the face. Separation in brightness, color, or focus helps make the subject easier to distinguish.",
      ],
      [
        "Head orientation",
        "Turning the head changes which facial surfaces face the camera and light. Small changes can reveal different contours and alter the balance of visible shadows.",
      ],
      [
        "Skin texture in images",
        "A face photograph records texture through lighting, focus, and image processing. Strong smoothing can remove detail and should not be confused with the subject’s actual skin.",
      ],
      [
        "Portrait consent",
        "Portrait photography involves a person as well as a camera. Discussing how an image will be used helps establish clear expectations before taking or sharing photographs.",
      ],
      [
        "Face alignment",
        "An image processing pipeline may rotate and crop a face using detected landmarks. Alignment reduces some geometric variation but does not eliminate changes in expression or illumination.",
      ],
      [
        "Sketching proportions",
        "A portrait sketch can begin with broad relationships between the eyes, nose, mouth, and head outline. Observed proportions matter more than assuming every face follows a single template.",
      ],
      [
        "Shadows and form",
        "Light and shadow make the three-dimensional form of a face visible in a flat image. A shadow’s edge depends on the light source and the surfaces blocking it.",
      ],
    ],
    contexts: [
      [
        "Portrait studio",
        "In a portrait studio, discuss the subject’s comfort before adjusting the pose. A simple test photograph can reveal whether lighting and framing match the intended result.",
      ],
      [
        "Photography class",
        "A photography class can compare portraits while changing one variable at a time. Keep camera position or lighting fixed to understand the effect of the other choice.",
      ],
      [
        "Computer vision note",
        "A computer vision note about faces should describe the input images and processing steps. Visual similarity is not proof of a person’s identity or emotional state.",
      ],
      [
        "Drawing workshop",
        "In a face drawing workshop, use careful observation of the specific subject. Guidelines are starting tools rather than rules that override visible individual differences.",
      ],
      [
        "Family photograph",
        "A family portrait session can favor a relaxed pace and familiar conversation. The aim is to make a clear photograph while respecting the people being photographed.",
      ],
      [
        "Image review",
        "When reviewing face photographs, compare focus, lighting, expression, and camera angle separately. This avoids attributing every visual difference to the person rather than the image conditions.",
      ],
    ],
  },
  {
    name: "Chairs",
    color: "#b58aff",
    facts: [
      [
        "Office chair ergonomics",
        "An adjustable office chair can support the feet, thighs, and lower back when fitted to its user. Seat height should allow a comfortable relationship with the desk and floor.",
      ],
      [
        "Seat depth",
        "A chair’s seat depth affects support beneath the thighs. A suitable fit leaves room behind the knees while supporting a useful portion of the legs.",
      ],
      [
        "Lumbar support",
        "Lumbar support provides contact near the lower back. Its position and firmness should fit the person rather than forcing every sitter into one identical posture.",
      ],
      [
        "Armrest adjustment",
        "Chair armrests can support the forearms without lifting the shoulders. An armrest that blocks access to the desk may need a different position or configuration.",
      ],
      [
        "Chair materials",
        "Wood, metal, plastic, and upholstered materials offer different structural and surface properties. Material choice affects weight, cleaning, repair, and the character of a chair.",
      ],
      [
        "Dining chair height",
        "Dining chair height should work with the table and the people using it. A visually attractive chair can still be uncomfortable if the seat-to-table relationship is unsuitable.",
      ],
      [
        "Stacking chairs",
        "Stacking chairs are designed to nest for storage. Their frame geometry must balance compact stacking with stability and useful seating dimensions.",
      ],
      [
        "Rocking chairs",
        "A rocking chair uses curved supports or a mechanism to allow controlled back-and-forth movement. The shape and balance of the base influence how the chair moves.",
      ],
      [
        "Chair stability",
        "A chair’s footprint and weight distribution influence its resistance to tipping. Stability should be evaluated in expected use rather than inferred from appearance alone.",
      ],
      [
        "Upholstery care",
        "Chair upholstery differs in weave, coatings, and cleaning requirements. Manufacturer care instructions help avoid treatments that damage the fabric or its finish.",
      ],
      [
        "Desk movement breaks",
        "Even a well-adjusted desk chair does not remove the need to change position. Alternating tasks and taking suitable movement breaks can interrupt prolonged static sitting.",
      ],
      [
        "Bentwood construction",
        "Bentwood chair parts are formed by bending prepared wood into curves. The process can create strong continuous shapes with fewer joints than some alternative constructions.",
      ],
      [
        "Wheel and floor pairing",
        "Office chair casters should suit the floor surface and expected load. A wheel that rolls well on carpet may behave differently on a hard smooth floor.",
      ],
      [
        "Chair repair",
        "A loose chair joint should be inspected before the chair returns to use. Repair methods depend on the joint design and material rather than a single universal adhesive.",
      ],
    ],
    contexts: [
      [
        "Home workstation",
        "At a home workstation, adjust the chair together with the desk and screen. A change in seat height affects where the arms, feet, and eyes meet the rest of the setup.",
      ],
      [
        "Furniture workshop",
        "A furniture workshop can compare chair construction through joints, load paths, and finish. The design should be evaluated for its intended use as well as its appearance.",
      ],
      [
        "Shared office",
        "A shared office chair needs adjustments that different users can understand. Simple visible controls make it easier to restore a useful fit when the sitter changes.",
      ],
      [
        "Interior planning",
        "Interior planning considers how chairs fit a room, table, and circulation path. Leave enough space for people to sit, stand, and move around occupied seats.",
      ],
      [
        "Furniture maintenance",
        "A chair maintenance check can examine fasteners, joints, wheels, and contact surfaces. Record a defect clearly so a damaged seat is not mistaken for a usable one.",
      ],
      [
        "Design comparison",
        "A chair design comparison should include dimensions and intended use. A compact occasional seat and a full-day task chair solve different problems.",
      ],
    ],
  },
  {
    name: "Birds",
    color: "#f9db62",
    facts: [
      [
        "Bird migration",
        "Many birds migrate between seasonal habitats as food availability and breeding conditions change. Species differ in their routes, timing, and the distances they travel.",
      ],
      [
        "Feather structure",
        "Bird feathers combine a central shaft with branching structures. Flight feathers and insulating down have different forms suited to different functions.",
      ],
      [
        "Birdsong learning",
        "Some songbirds learn parts of their songs through listening and practice. Calls and songs can serve different communication functions depending on species and context.",
      ],
      [
        "Wing shape",
        "A bird’s wing shape relates to how it flies. Long narrow wings can support efficient gliding, while other shapes suit maneuvering through vegetation.",
      ],
      [
        "Beak adaptations",
        "Bird beaks vary with feeding strategies. A seed-cracking beak and a slender probing beak interact with food in different ways.",
      ],
      [
        "Nesting materials",
        "Bird species use diverse nesting sites and materials. A nest’s form reflects behavior, habitat, and the needs of eggs and young.",
      ],
      [
        "Wetland birds",
        "Wetlands provide feeding and resting habitat for many birds. Water depth and vegetation influence which species can use a particular area.",
      ],
      [
        "Bird observation",
        "Birdwatchers can identify a bird using shape, movement, habitat, voice, and markings. A brief view may not provide enough evidence for a confident identification.",
      ],
      [
        "Seasonal plumage",
        "Some birds change appearance through molt and seasonal feather wear. Age and sex can also influence plumage, so identification requires more than one color patch.",
      ],
      [
        "Flocking behavior",
        "Bird flocks can coordinate movement through responses to nearby individuals. Group behavior may help with foraging or predator detection, depending on the species.",
      ],
      [
        "Urban bird habitat",
        "Urban birds use trees, buildings, parks, and other features as habitat. Food sources and nesting opportunities affect which species occur in a neighborhood.",
      ],
      [
        "Soaring flight",
        "A soaring bird can use rising air to gain height with less flapping. Thermals and wind over terrain provide different sources of lift.",
      ],
      [
        "Bird feeding ecology",
        "A bird’s diet may change with season and food availability. Observing what it eats and where it searches helps explain its role in an ecosystem.",
      ],
      [
        "Conservation counts",
        "Repeated bird counts can help track changes in observations over time. Consistent methods and effort are important when comparing counts between places or seasons.",
      ],
    ],
    contexts: [
      [
        "Field notebook",
        "A bird field notebook can record date, location, habitat, behavior, and confidence in identification. Specific notes help later comparisons without overstating what was observed.",
      ],
      [
        "Nature walk",
        "During a birdwatching walk, observe quietly and leave room around feeding or nesting animals. Binoculars make it possible to inspect details without approaching closely.",
      ],
      [
        "Classroom ecology",
        "A classroom ecology exercise can connect bird behavior to habitat and food. Compare observations rather than assuming that every species uses the same strategy.",
      ],
      [
        "Seasonal survey",
        "A seasonal bird survey should record its route, timing, and effort. Changes in observations can reflect both animal behavior and the conditions under which people counted.",
      ],
      [
        "Habitat restoration",
        "Bird habitat restoration considers vegetation, water, shelter, and disturbance. A useful design depends on the species and local conditions it is intended to support.",
      ],
      [
        "Photography hide",
        "A bird photography hide offers a place to observe at a distance. Patient observation can reveal behavior while reducing disturbance compared with repeatedly following an animal.",
      ],
    ],
  },
];

export const REAL_TOPICS = topics.map(({ name, color }) => ({ name, color }));
export const REAL_QUERY_PRESETS = [
  "How do cats communicate with their tails?",
  "How can a dog learn to come when called?",
  "How does regenerative braking work?",
  "What makes a portrait look natural?",
  "What makes an office chair ergonomic?",
  "Why do birds migrate?",
];
export const REAL_CORPUS: RealDocument[] = Array.from(
  { length: 84 },
  (_, item) =>
    topics.map((topic) => {
      const [title, fact] = topic.facts[item % topic.facts.length];
      const [contextTitle, context] =
        topic.contexts[Math.floor(item / topic.facts.length)];
      return {
        id: `${topic.name.toLowerCase()}-${String(item + 1).padStart(3, "0")}`,
        title: `${title} · ${contextTitle}`,
        text: `${fact} ${context}`,
        topic: topic.name,
        color: topic.color,
      };
    }),
)
  .flat()
  .slice(0, 500);

/** Content changes invalidate derived embedding caches; not a security hash. */
export function corpusHash(documents: RealDocument[]): string {
  let hash = 2166136261;
  for (const document of documents)
    for (const char of `${document.id}\n${document.title}\n${document.text}\n`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  return (hash >>> 0).toString(16);
}
export const REAL_CORPUS_HASH = corpusHash(REAL_CORPUS);
