---
topic: linear systems
chapter: 3
---

# Linear Systems, Gaussian Elimination, and Consistency

## Translate equations into a matrix

A linear system in $n$ unknowns has the form $Ax=b$. The matrix $A$
contains the coefficients; the vector $x$ contains the unknowns; and
$b$ contains the right-hand sides. For instance,

$$\begin{cases}x+2y=5,\\3x+4y=11\end{cases}
\quad\Longleftrightarrow\quad
\begin{pmatrix}1&2\\3&4\end{pmatrix}
\begin{pmatrix}x\\y\end{pmatrix}
=\begin{pmatrix}5\\11\end{pmatrix}.$$

An augmented matrix $[A\mid b]$ keeps coefficients and right-hand
sides together. It is an efficient representation for row reduction.

## Gaussian elimination, step by step

Three *elementary row operations* preserve the solution set:

1. Swap two rows.
2. Multiply a row by a nonzero scalar.
3. Add a scalar multiple of one row to another row.

Starting from the example,

$$\left[\begin{array}{cc|c}1&2&5\\3&4&11\end{array}\right]
\xrightarrow{R_2\leftarrow R_2-3R_1}
\left[\begin{array}{cc|c}1&2&5\\0&-2&-4\end{array}\right].$$

Back-substitution gives $y=2$ and $x=1$. Verify in both original
equations; a correct row reduction has not changed their common
solutions.

With enough row operations, a *reduced row-echelon form* (RREF) has
leading ones with zeros above and below each pivot. Pivot columns
identify constrained variables; non-pivot columns give free variables.

## Exactly one, none, or infinitely many solutions

For a real system $Ax=b$, the consistency criterion is

$$\operatorname{rank}(A)=\operatorname{rank}([A\mid b]).$$

If the ranks differ, the system is inconsistent. If they agree and
equal the number $n$ of unknowns, the solution is unique. If they
agree but are smaller than $n$, there are infinitely many solutions
because at least one free variable remains.

Compare these systems:

- $x+y=2$ and $2x+2y=4$: infinitely many solutions
  $(x,y)=(2-t,t)$ for $t\in\mathbb{R}$.
- $x+y=1$ and $x+y=2$: no solution; subtracting the equations
  produces $0=1$.
- $x+y=2$ and $x-y=0$: one solution, $(1,1)$.

The count of equations alone does not determine the answer. The
rank and the right-hand side matter.

## Homogeneous systems and the null space

The homogeneous system $Ax=0$ always has the trivial solution $x=0$.
Nonzero solutions exist exactly when $\operatorname{rank}(A)<n$.
All homogeneous solutions form the null space
$\ker(A)=\{x:Ax=0\}$, a vector subspace. This connects Gaussian
elimination to the later concepts of basis and dimension.

## Numerical computation and its limits

For a nonsingular square system, use a direct solver such as
`numpy.linalg.solve`. Do not compute `inv(A) @ b` merely to solve the
system: explicitly forming the inverse usually costs more and may
increase numerical error.

```python
import numpy as np

a = np.array([[1., 2.], [3., 4.]])
b = np.array([5., 11.])
x = np.linalg.solve(a, b)
print(x)  # [1., 2.]
print(np.allclose(a @ x, b))  # True

# For a rectangular system, compute a least-squares candidate.
rectangular = np.array([[1.], [1.], [1.]])
rhs = np.array([1., 2., 4.])
coefficient, residuals, rank, singular_values = np.linalg.lstsq(
    rectangular, rhs, rcond=None
)
print(coefficient)  # [2.33333333]
```

A least-squares solution minimizes $\|Ax-b\|_2^2$. It is not generally
an exact solution when a system is inconsistent. Exact mathematical
rank and numerically estimated rank can differ near a singular matrix;
algorithms use tolerances.

## Socratic checkpoints

1. In the elimination example, what does the pivot $-2$ tell you
   before you finish back-substitution?
2. Does $Ax=0$ ever have no solution? Why?
3. For a system with five unknowns and rank three that is known to be
   consistent, how many free variables are there?
4. If a program reports a small residual $\|Ax-b\|$, has it proved
   the solution is mathematically unique?
