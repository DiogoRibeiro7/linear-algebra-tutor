---
topic: determinants
chapter: 6
---

# Determinants, Invertibility, and Oriented Volume

## What the determinant tells us

The determinant $\det(A)$ is a scalar defined for a square matrix.
Its absolute value describes the factor by which $A$ scales
$n$-dimensional volume; its sign records whether orientation is
preserved or reversed. A zero determinant means that some nonzero
direction is collapsed, so the map is not invertible.

For $A=\begin{pmatrix}a&b\\c&d\end{pmatrix}$,

$$\det(A)=ad-bc.$$

For example, $A=\begin{pmatrix}1&2\\3&4\end{pmatrix}$ has
$\det(A)=4-6=-2$. The absolute area factor is two and the negative
sign indicates an orientation reversal.

## Row operations and determinants

Determinants behave predictably under elementary row operations:

- Swapping two rows changes the sign of the determinant.
- Multiplying one row by $c$ multiplies the determinant by $c$.
- Adding a multiple of one row to another leaves the determinant
  unchanged.

For a triangular matrix, the determinant is the product of its
diagonal entries. This is why elimination can compute determinants
efficiently, provided the effects of row swaps and scaling are
tracked correctly.

The determinant is linear in each row separately when the other rows
are fixed, and alternating: two equal rows force determinant zero.
It is *not* a linear function of the matrix as a whole in general.

## The $3\times3$ case

For

$$A=\begin{pmatrix}a&b&c\\d&e&f\\g&h&i\end{pmatrix},$$

expansion along the first row gives

$$\det(A)=a(ei-fh)-b(di-fg)+c(dh-eg).$$

The alternating signs are essential. For large matrices, cofactor
expansion is a poor numerical algorithm; stable elimination or
factorizations are usually preferred.

## Four connected statements

For a square $n\times n$ matrix $A$, the following are equivalent:

1. $\det(A)\ne0$.
2. $A$ is invertible.
3. The columns of $A$ form a basis of $\mathbb{R}^n$.
4. The homogeneous system $Ax=0$ has only $x=0$.

The determinant thus connects geometry, algebraic independence,
rank, and linear systems.

Two important identities are

$$\det(AB)=\det(A)\det(B),\qquad
\det(A^T)=\det(A).$$

If $A$ is invertible, $\det(A^{-1})=1/\det(A)$. Note that, for
$n>1$, $\det(A+B)$ is generally *not* $\det(A)+\det(B)$.

## Python: numerical care

```python
import numpy as np

a = np.array([[1., 2.], [3., 4.]])
print(np.linalg.det(a))  # approximately -2.0

singular = np.array([[2., 1.], [4., 2.]])
print(np.linalg.matrix_rank(singular))  # 1

# For very large or small determinant magnitudes, avoid overflow.
sign, log_absolute_determinant = np.linalg.slogdet(a)
print(sign, log_absolute_determinant)
```

In floating-point arithmetic, a determinant near zero does not
establish exact singularity, and a nonzero determinant does not
guarantee numerical stability. Use singular values or a condition
number to assess near-singular systems.

## Socratic checkpoints

1. What happens to the determinant when two columns coincide?
2. Without expanding cofactors, find the determinant of an upper
   triangular $3\times3$ matrix with diagonal entries $2, -1, 5$.
3. If $\det(A)=-3$ for a $2\times2$ transformation, what happens
   to the area and orientation of the unit square?
4. Why can you decide whether a square matrix is invertible by
   finding its rank instead of evaluating its determinant?
