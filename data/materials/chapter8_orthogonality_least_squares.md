---
topic: orthogonality and least squares
chapter: 8
---

# Orthogonality, Projection, and Least Squares

## Inner products and orthogonality

For vectors $u,v\in\mathbb{R}^n$, the standard inner product is

$$\langle u,v\rangle=u^Tv=\sum_{i=1}^nu_iv_i.$$

Vectors are orthogonal when their inner product is zero. For
nonzero vectors, the geometric angle satisfies

$$\cos\theta=\frac{u^Tv}{\|u\|_2\|v\|_2}.$$

The zero vector is orthogonal to every vector in the algebraic
sense, but an angle involving zero is undefined. The Euclidean
norm is $\|v\|_2=\sqrt{v^Tv}$.

## Projection onto a line

Given a nonzero vector $u$, the orthogonal projection of $v$
onto the line spanned by $u$ is

$$\operatorname{proj}_u(v)=\frac{v^Tu}{u^Tu}u.$$

The residual $r=v-\operatorname{proj}_u(v)$ is orthogonal to
$u$. For instance, projecting $(3,4)^T$ onto the x-axis generated
by $(1,0)^T$ gives $(3,0)^T$ and residual $(0,4)^T$.

If the columns of $Q$ are orthonormal, so $Q^TQ=I$, projection
onto their span has the simpler form $QQ^Tv$. Orthonormality
removes the need to solve a separate coefficient system.

## Constructing an orthonormal basis

The Gram–Schmidt process starts with linearly independent vectors
$v_1,\ldots,v_k$ and removes projections onto already constructed
directions:

$$q_1=\frac{v_1}{\|v_1\|_2},\qquad
u_2=v_2-(q_1^Tv_2)q_1,\qquad
q_2=\frac{u_2}{\|u_2\|_2}.$$

Continue by subtracting the projections onto all previous $q_j$.
In numerical software, stable QR algorithms (such as Householder
reflections) are generally preferred to classical Gram–Schmidt.

## Least squares as a projection problem

When $Ax=b$ is inconsistent, least squares finds coefficients

$$\hat{x}=\arg\min_x\|Ax-b\|_2^2.$$

Geometrically, $A\hat{x}$ is the orthogonal projection of $b$
onto the column space of $A$. Consequently the residual is
orthogonal to every column of $A$:

$$A^T(A\hat{x}-b)=0,$$

or, equivalently, $A^TA\hat{x}=A^Tb$ (the normal equations).
If $A$ has full column rank, the minimizer is unique; otherwise
multiple coefficient vectors may minimize the residual.

Consider three observations $b=(1,2,4)^T$ and a constant-only
model $A=(1,1,1)^T$. The optimal fitted constant is the mean,

$$\hat{x}=\frac{1+2+4}{3}=\frac73.$$

The residual $b-A\hat{x}=(-4/3,-1/3,5/3)^T$ sums to zero,
so it is orthogonal to the single column of $A$. This illustrates
the projection interpretation directly.

## Numerical stability

Although normal equations describe the mathematics, explicitly
forming $A^TA$ squares the condition number for a full-column-rank
matrix in the 2-norm. Prefer a QR- or SVD-based solver, especially
for ill-conditioned data. Singular value decomposition also
identifies rank-deficient directions.

```python
import numpy as np

a = np.ones((3, 1))
b = np.array([1., 2., 4.])
coefficient, *_ = np.linalg.lstsq(a, b, rcond=None)
residual = b - a @ coefficient

print(coefficient[0])  # 2.333333333333333
print(np.allclose(a.T @ residual, 0.))  # True
```

The exact least-squares argument assumes real arithmetic. Practical
algorithms use floating-point approximations and tolerance-dependent
rank decisions.

## Socratic checkpoints

1. Why must the projection formula exclude $u=0$?
2. How can you verify a proposed projection without recomputing
   its coefficients?
3. For a least-squares fit, what must be orthogonal to the residual?
4. Does a small residual imply that the coefficients are uniquely
   determined? Explain using rank.
