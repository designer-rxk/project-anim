import "pathseg";
import Matter from "matter-js";
import decomp from "poly-decomp";

const animationContainer = document.querySelector(
  ".canvas-container"
) as HTMLElement;

const initAnimation = () => {
  const {
    Engine,
    Render,
    Runner,
    Common,
    MouseConstraint,
    Mouse,
    Composite,
    Vertices,
    Svg,
    Bodies,
    Vector,
  } = Matter;

  // Provide concave decomposition support library
  Common.setDecomp(decomp);

  // Create engine
  const engine = Engine.create();
  const world = engine.world;

  // Create renderer
  const render = Render.create({
    element: animationContainer,
    canvas: document.getElementById("world") as HTMLCanvasElement,
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "#FF7B42",
    },
  });

  Render.run(render);

  // Create runner
  const runner = Runner.create();
  Runner.run(runner, engine);

  let lettersSpawned = false; // Flag to prevent multiple spawns

  // Add bodies
  if (typeof fetch !== "undefined") {
    const select = (root: Document, selector: string) =>
      Array.prototype.slice.call(root.querySelectorAll(selector));

    const loadSvg = (url: string) => {
      return fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
          }
          return response.text();
        })
        .then((raw) =>
          new window.DOMParser().parseFromString(raw, "image/svg+xml")
        );
    };

    // Load the SVGs once and store them in an array
    const svgPaths = ["./letters/T.svg", "./letters/R.svg", "./letters/Y.svg"];
    const loadedVertexSets = [];

    const loadAllSvgs = () => {
      return Promise.all(svgPaths.map(loadSvg)).then((roots) => {
        roots.forEach((root) => {
          const vertexSets = select(root, "path").map((path) =>
            Vertices.scale(Svg.pathToVertices(path, 0), 1, 1)
          );
          loadedVertexSets.push(vertexSets);
        });
      });
    };

    const spawnLetters = (totalLetters: number, spawnInterval: number) => {
      if (lettersSpawned) return; // Prevent double spawning
      lettersSpawned = true;

      const spacing = 75; // Space between each letter
      const viewportWidth = window.innerWidth;
      const spawnAreaWidth = viewportWidth * 0.6; // 60% of the viewport width
      const startX = viewportWidth - spawnAreaWidth; // Start X position for the rightmost 60%
      const maxHeightAboveViewport = 50; // Maximum height above the viewport
      const gridSize = spacing; // Size of each grid cell
      const occupiedGridCells = new Set<string>(); // To track occupied grid cells
      const maxAttempts = 100; // Max attempts to find a unique position

      let lettersSpawnedCount = 0;

      // Function to generate a unique position within the rightmost 60% of the viewport
      const getUniquePosition = () => {
        let attempts = 0;

        while (attempts < maxAttempts) {
          const x =
            startX +
            Math.floor((Math.random() * spawnAreaWidth) / gridSize) * gridSize;
          const y =
            -20 +
            Math.floor((Math.random() * maxHeightAboveViewport) / gridSize) *
              gridSize;
          const gridKey = `${Math.floor(x / gridSize)},${Math.floor(
            y / gridSize
          )}`;

          // Check if the grid cell is already occupied
          if (!occupiedGridCells.has(gridKey)) {
            occupiedGridCells.add(gridKey);
            return { x, y };
          }

          attempts++;
        }

        // Return a default position if no unique position is found after max attempts
        return {
          x: startX + Math.random() * spawnAreaWidth,
          y: -20 + Math.random() * maxHeightAboveViewport,
        };
      };

      // Function to spawn a letter
      const spawnLetter = () => {
        if (lettersSpawnedCount >= totalLetters) return; // Stop when we've spawned enough letters

        // Select a random letter from the loaded vertex sets
        const randomIndex = Math.floor(Math.random() * loadedVertexSets.length);
        const vertexSets = loadedVertexSets[randomIndex];

        const { x, y } = getUniquePosition(); // Get a unique position

        const color = Common.choose(["#CF6337"]);
        Composite.add(
          world,
          Bodies.fromVertices(
            x,
            y,
            vertexSets,
            {
              render: {
                fillStyle: color,
                strokeStyle: color,
                lineWidth: 1,
              },
            },
            true
          )
        );

        lettersSpawnedCount++;

        if (lettersSpawnedCount >= totalLetters) {
          clearInterval(spawnIntervalId); // Stop the interval when enough letters are spawned
        }
      };

      const spawnIntervalId = setInterval(spawnLetter, spawnInterval);
    };

    // Load SVGs and spawn letters after loading
    loadAllSvgs().then(() => {
      spawnLetters(200, 50); // Spawn a total of 200 letters with a 100ms interval between each
    });

    let scrollTimeout;
    function handleScroll() {
      render.canvas.style.pointerEvents = "none";
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        render.canvas.style.pointerEvents = "auto";
      }, 200);
    }

    render.canvas.addEventListener("wheel", handleScroll);

    // Create ground and walls
    let ground, leftWall, rightWall, topBox;

    function createBoundaries() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Remove existing boundaries if they exist
      if (ground) {
        Composite.remove(engine.world, [ground, leftWall, rightWall, topBox]);
      }

      // Create new boundaries
      ground = Bodies.rectangle(width / 2, height + 5, width, 50, {
        isStatic: true,
        render: { visible: false },
      });
      leftWall = Bodies.rectangle(-5, height / 2, 20, height, {
        isStatic: true,
        render: { visible: false },
      });
      rightWall = Bodies.rectangle(width - 5, height / 2, 20, height, {
        isStatic: true,
        render: { visible: false },
      });

      // Add a box at the top to prevent balls from flying away
      topBox = Bodies.rectangle(width / 2, -20, width, 40, {
        isStatic: true,
        render: { visible: false },
      });

      // Add boundaries to the world
      Composite.add(engine.world, [ground, leftWall, rightWall, topBox]);
    }

    // Initial creation of boundaries
    createBoundaries();

    // Load SVGs and spawn letters after loading
    loadAllSvgs().then(() => {
      spawnLetters(200);
    });

    // Add mouse control
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false,
        },
      },
    });

    Composite.add(world, mouseConstraint);

    // Keep the mouse in sync with rendering
    render.mouse = mouse;

    // Fit the render viewport to the scene
    Render.lookAt(render, {
      min: { x: 0, y: 0 },
      max: {
        x: animationContainer.clientWidth,
        y: animationContainer.clientHeight,
      },
    });

    // Repel effect function
    const repelLetters = () => {
      const mousePosition = mouse.position;
      Composite.allBodies(engine.world).forEach((body) => {
        const distance = Vector.magnitude(
          Vector.sub(body.position, mousePosition)
        );
        if (distance < 75) {
          const direction = Vector.normalise(
            Vector.sub(body.position, mousePosition)
          );
          const forceMagnitude = 0.001 * (100 - distance);
          const force = Vector.mult(direction, forceMagnitude);
          Matter.Body.applyForce(body, body.position, force);
        }
      });
    };

    // Push letters upwards on scroll
    const pushLettersUpwards = () => {
      const scrollY = window.scrollY;
      Composite.allBodies(engine.world).forEach((body) => {
        const forceMagnitude = 0.00005 * scrollY; // Adjust force magnitude as needed
        const force = { x: 0, y: -forceMagnitude };
        Matter.Body.applyForce(body, body.position, force);
      });
    };

    // Add scroll event listener
    window.addEventListener("scroll", () => {
      pushLettersUpwards();
    });

    render.canvas.addEventListener("mousemove", () => {
      repelLetters();
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      render.canvas.width = window.innerWidth;
      render.canvas.height = window.innerHeight;
      render.options.width = window.innerWidth;
      render.options.height = window.innerHeight;
      createBoundaries();
    });
  }
};

initAnimation();
