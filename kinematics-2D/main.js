const SCALE = 100;
const GRAVITY = 9.81;
const RESTITUTION = 0.9;
const DT = 0.016;
const PARTICLE_RADIUS = 0.1; // base radius (meters) for a mass-1 particle

let windEnabled = false;
let windMagnitude = 10;
let windDirX = 1;
let windDirY = 0;

let heldParticle = null;
let steeringWind = false;

let particles = [];

function setup() {
  createCanvas(windowWidth / 2, windowHeight / 2);
}

function draw() {
  background(0);
  noFill();
  stroke(255);
  rect(0, 0, width, height);
  drawWind();

  if (particles.length > 0) {
    update(DT);
    handleBoundaries();
    handleCollisions();
    noStroke();
    textAlign(CENTER, CENTER);
    particles.forEach((particle) => {
      // Color encodes mass: cyan (light) -> magenta (heavy)
      const t = constrain(map(particle.mass, 1, 10, 0, 1), 0, 1);
      const r = lerp(100, 240, t);
      const g = lerp(220, 46, t);
      const b = lerp(255, 170, t);

      const px = particle.x * SCALE;
      const py = particle.y * SCALE;

      fill(r, g, b);
      circle(px, py, particle.radius * 2 * SCALE);

      // Label each particle with its mass (rounded for display only)
      fill(20);
      textSize(Math.min(14, particle.radius * SCALE));
      text(+particle.mass.toFixed(1), px, py);
    });
  }
}

// drawWind assumes (windDirX, windDirY) is a unit vector
function drawWind() {
  if (!windEnabled) return;
  if (windMagnitude === 0) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const shaftLength = windMagnitude * 2;

  const endX = centerX + windDirX * shaftLength;
  const endY = centerY + windDirY * shaftLength;

  const headLen = Math.min(12, shaftLength * 0.5);
  const headWidth = headLen * 0.5;
  const perpX = -windDirY;
  const perpY = windDirX;

  const baseX = endX - windDirX * headLen;
  const baseY = endY - windDirY * headLen;

  const leftX = baseX + perpX * headWidth;
  const leftY = baseY + perpY * headWidth;
  const rightX = baseX - perpX * headWidth;
  const rightY = baseY - perpY * headWidth;

  push();
  stroke(255, 0, 200);
  strokeWeight(2);
  line(centerX, centerY, endX, endY);

  noStroke();
  fill(255, 0, 200);
  triangle(endX, endY, leftX, leftY, rightX, rightY);
  pop();
}

function updateWindDirection() {
  const dx = mouseX - width / 2;
  const dy = mouseY - height / 2;

  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return;

  windDirX = dx / distance;
  windDirY = dy / distance;
}

function isInsideCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function getParticleIndexAtMouse() {
  // Iterate from last (drawn on top) to first so we grab the topmost particle
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const dx = mouseX - p.x * SCALE;
    const dy = mouseY - p.y * SCALE;
    if (Math.sqrt(dx * dx + dy * dy) <= p.radius * SCALE) {
      return i;
    }
  }
  return -1;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;

  let t = lengthSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * abx;
  const closestY = ay + t * aby;

  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMouseOnArrow() {
  if (!windEnabled || windMagnitude === 0) return false;

  const centerX = width / 2;
  const centerY = height / 2;
  const shaftLength = windMagnitude * 2;
  const endX = centerX + windDirX * shaftLength;
  const endY = centerY + windDirY * shaftLength;

  return distToSegment(mouseX, mouseY, centerX, centerY, endX, endY) <= 8;
}

function mousePressed() {
  if (!isInsideCanvas()) return;

  const index = getParticleIndexAtMouse();
  if (index !== -1) {
    heldParticle = particles[index];
    return false;
  }

  if (isMouseOnArrow()) {
    steeringWind = true;
    return false;
  }
}

function mouseDragged() {
  // A held particle is moved in update() each frame; here we only steer wind
  if (steeringWind) {
    updateWindDirection();
    return false;
  }
}

function mouseReleased() {
  heldParticle = null;
  steeringWind = false;
  return false;
}

function doubleClicked() {
  if (!isInsideCanvas()) return;

  // Cancel any in-progress grab before removing, so heldParticle never
  // dangles on a particle that no longer exists in the array.
  heldParticle = null;

  const index = getParticleIndexAtMouse();
  if (index !== -1) {
    particles.splice(index, 1);
    return false;
  }
}

function update(dt) {
  if (dt <= 0) return;

  particles.forEach((particle) => {
    if (particle === heldParticle) {
      // While held, the particle ignores all forces and follows the mouse.
      // Its velocity is derived from the mouse movement so it keeps that
      // momentum when released (the "throw"). The target is clamped to the
      // box so it can't be dragged out of the sandbox.
      const minX = particle.radius;
      const maxX = width / SCALE - particle.radius;
      const minY = particle.radius;
      const maxY = height / SCALE - particle.radius;

      const targetX = Math.min(Math.max(mouseX / SCALE, minX), maxX);
      const targetY = Math.min(Math.max(mouseY / SCALE, minY), maxY);

      particle.vx = (targetX - particle.x) / dt;
      particle.vy = (targetY - particle.y) / dt;

      particle.x = targetX;
      particle.y = targetY;
      return;
    }

    let fx = 0;
    let fy = 0;

    fy += particle.mass * GRAVITY;

    if (windEnabled){
      fx += windDirX * windMagnitude;
      fy += windDirY * windMagnitude;
    }

    particle.ax = fx / particle.mass;
    particle.ay = fy / particle.mass;

    particle.vx = particle.vx + particle.ax * dt;
    particle.vy = particle.vy + particle.ay * dt;

    particle.x = particle.x + particle.vx * dt;
    particle.y = particle.y + particle.vy * dt;
  });
}

function handleBoundaries() {
  particles.forEach((particle) => {
    if (particle === heldParticle) return;

    if (particle.y > height / SCALE - particle.radius) {
      particle.y = height / SCALE - particle.radius;
      particle.vy = particle.vy * -RESTITUTION;
    }

    if (particle.y < particle.radius) {
      particle.y = particle.radius;
      particle.vy = particle.vy * -RESTITUTION;
    }

    if (particle.x > width / SCALE - particle.radius) {
      particle.x = width / SCALE - particle.radius;
      particle.vx = particle.vx * -RESTITUTION;
    }

    if (particle.x < particle.radius) {
      particle.x = particle.radius;
      particle.vx = particle.vx * -RESTITUTION;
    }
  });
}

function massToRadius(mass) {
  // radius grows with sqrt(mass) because area (not radius) scales with mass.
  // Capped so a huge mass can never exceed the box and break the clamps.
  const maxRadius = Math.min(width, height) / (4 * SCALE);
  return Math.min(PARTICLE_RADIUS * Math.sqrt(mass), maxRadius);
}

function getParticleProperties() {
  if (particles.length === 4) {
    alert("Only 4 particles can be at the same time in the playground!");
    return;
  }

  const xPosition = Number(document.getElementById("x-position").value);
  const yPosition = Number(document.getElementById("y-position").value);

  const xVelocity = Number(document.getElementById("x-velocity").value);
  const yVelocity = Number(document.getElementById("y-velocity").value);

  const particleMass = Number(document.getElementById("mass").value);
  if(particleMass <= 0){
    alert ("Invalid value for mass")
    return;
  } 

  const newParticle = {
    x: xPosition,
    y: yPosition,
    vx: xVelocity,
    vy: yVelocity,
    mass: particleMass,
    radius: massToRadius(particleMass),
    ay: 0,
    ax: 0
  };

  particles.push(newParticle);
}

const createParticleBtn = document.getElementById("create-particle-btn");
createParticleBtn.addEventListener("click", getParticleProperties);

const windForceSlider = document.getElementById("wind-force");
const windForceValue = document.getElementById("wind-force-value");
windForceSlider.addEventListener("input", () => {
  windMagnitude = Number(windForceSlider.value);
  windForceValue.textContent = windMagnitude;
});

const windToggle = document.getElementById("wind-toggle");
windToggle.addEventListener("change", () => {
  windEnabled = windToggle.checked;
});

function handleCollisions() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      let dx = particles[j].x - particles[i].x;
      let dy = particles[j].y - particles[i].y;

      let distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) distance = 0.0001;

      const p1 = particles[i];
      const p2 = particles[j];
      const sumRadius = p1.radius + p2.radius;

      if (distance < sumRadius) {
        const nx = dx / distance;
        const ny = dy / distance;

        const overlap = sumRadius - distance;

        // A held particle acts as infinite mass: it pushes others but is not
        // moved by the collision (its motion stays driven by the mouse).
        const invMass1 = p1 === heldParticle ? 0 : 1 / p1.mass;
        const invMass2 = p2 === heldParticle ? 0 : 1 / p2.mass;
        const totalInvMass = invMass1 + invMass2;
        if (totalInvMass === 0) continue;

        const correction1 = overlap * invMass1 / totalInvMass;
        const correction2 = overlap * invMass2 / totalInvMass;

        p1.x -= nx * correction1;
        p1.y -= ny * correction1;
        p2.x += nx * correction2;
        p2.y += ny * correction2;

        const dvx = p2.vx - p1.vx;
        const dvy = p2.vy - p1.vy;

        const vn = dvx * nx + dvy * ny;
        if (vn < 0) {
          const impulse = -(1 + RESTITUTION) * vn / totalInvMass;

          p1.vx -= impulse * invMass1 * nx;
          p1.vy -= impulse * invMass1 * ny;
          p2.vx += impulse * invMass2 * nx;
          p2.vy += impulse * invMass2 * ny;
        }
      }
    }
  }
}