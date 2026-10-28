---
topic: vectors
chapter: 1
---

# Introduction to Vectors

## What is a Vector?

A **vector** is a mathematical object that has both magnitude (size) and direction. Vectors are fundamental in Linear Algebra and have applications in physics, engineering, computer graphics, and machine learning.

### Mathematical Notation

We represent vectors in several ways:
- Bold lowercase letters: **v**, **u**, **a**
- Arrow notation: $\vec{v}$, $\vec{u}$, $\vec{a}$
- Component form: $\vec{v} = \begin{pmatrix} v_1 \\ v_2 \\ v_3 \end{pmatrix}$

## Vector Operations

### Addition
Adding two vectors means adding their corresponding components:

$$\vec{a} + \vec{b} = \begin{pmatrix} a_1 \\ a_2 \end{pmatrix} + \begin{pmatrix} b_1 \\ b_2 \end{pmatrix} = \begin{pmatrix} a_1 + b_1 \\ a_2 + b_2 \end{pmatrix}$$

**Example:**
$$\begin{pmatrix} 2 \\ 3 \end{pmatrix} + \begin{pmatrix} 1 \\ 4 \end{pmatrix} = \begin{pmatrix} 3 \\ 7 \end{pmatrix}$$

### Scalar Multiplication
Multiplying a vector by a scalar (a number) multiplies each component:

$$k\vec{v} = k \begin{pmatrix} v_1 \\ v_2 \end{pmatrix} = \begin{pmatrix} kv_1 \\ kv_2 \end{pmatrix}$$

**Example:**
$$3 \begin{pmatrix} 2 \\ 1 \end{pmatrix} = \begin{pmatrix} 6 \\ 3 \end{pmatrix}$$

### Dot Product (Inner Product)
The dot product of two vectors produces a scalar:

$$\vec{a} \cdot \vec{b} = a_1b_1 + a_2b_2 + \ldots + a_nb_n$$

Or equivalently:
$$\vec{a} \cdot \vec{b} = |\vec{a}||\vec{b}|\cos\theta$$

where $\theta$ is the angle between the vectors.

**Example:**
$$\begin{pmatrix} 2 \\ 3 \end{pmatrix} \cdot \begin{pmatrix} 1 \\ 4 \end{pmatrix} = 2(1) + 3(4) = 2 + 12 = 14$$

## Python Implementation

Here's how to work with vectors in NumPy:

```python
import numpy as np

# Create vectors
a = np.array([2, 3])
b = np.array([1, 4])

# Vector addition
c = a + b
print(f"a + b = {c}")  # [3, 7]

# Scalar multiplication
d = 3 * a
print(f"3 * a = {d}")  # [6, 9]

# Dot product
dot = np.dot(a, b)
print(f"a · b = {dot}")  # 14

# Magnitude (length) of a vector
magnitude_a = np.linalg.norm(a)
print(f"|a| = {magnitude_a}")  # 3.605...

# Unit vector (normalized)
unit_a = a / magnitude_a
print(f"Unit vector: {unit_a}")
```

## Geometric Interpretation

### Magnitude
The magnitude (or length) of a vector $\vec{v} = \begin{pmatrix} v_1 \\ v_2 \end{pmatrix}$ is:

$$|\vec{v}| = \sqrt{v_1^2 + v_2^2}$$

This is just the Pythagorean theorem!

### Direction
For a nonzero planar vector, its direction can be described by the angle from the
positive x-axis:

$$\theta = \operatorname{atan2}(v_2,v_1).$$

Using $\operatorname{atan2}$ preserves the quadrant, including when $v_1=0$.
The zero vector has no defined direction. The simpler expression
$\arctan(v_2/v_1)$ loses quadrant information and fails for $v_1=0$.

## Applications

### Physics
- **Displacement**: Position changes in space
- **Velocity**: Speed with direction
- **Force**: Magnitude and direction of applied forces

### Computer Graphics
- **Position**: Locating objects in 3D space
- **Normals**: Surface orientation for lighting
- **Motion**: Animation and movement

### Machine Learning
- **Features**: Data points as vectors
- **Weights**: Model parameters
- **Embeddings**: Representing words or images as vectors

## Key Properties

1. **Commutativity of Addition**: $\vec{a} + \vec{b} = \vec{b} + \vec{a}$
2. **Associativity**: $(\vec{a} + \vec{b}) + \vec{c} = \vec{a} + (\vec{b} + \vec{c})$
3. **Zero Vector**: $\vec{v} + \vec{0} = \vec{v}$
4. **Distributivity**: $k(\vec{a} + \vec{b}) = k\vec{a} + k\vec{b}$

## Practice Problems

1. Calculate $\begin{pmatrix} 5 \\ 2 \end{pmatrix} + \begin{pmatrix} -3 \\ 4 \end{pmatrix}$

2. Find the magnitude of $\vec{v} = \begin{pmatrix} 3 \\ 4 \end{pmatrix}$

3. Calculate the dot product: $\begin{pmatrix} 1 \\ 2 \\ 3 \end{pmatrix} \cdot \begin{pmatrix} 4 \\ 5 \\ 6 \end{pmatrix}$

4. If $\vec{a} \cdot \vec{b} = 0$, what can you conclude about orthogonality?
   Does your statement change when one of the vectors is the zero vector?
