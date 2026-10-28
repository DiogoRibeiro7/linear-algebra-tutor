---
topic: eigenvalues and eigenvectors
chapter: 7
---

# Eigenvalues, Eigenvectors, and Diagonalization

## Directions preserved by a linear map

An eigenvector of a square matrix $A$ is a *nonzero* vector $v$
satisfying

$$Av=\lambda v.$$

The scalar $\lambda$ is its eigenvalue. The map stretches, reverses,
or collapses the direction of $v$ without turning it into an
independent direction. The zero vector is excluded because it
would satisfy the equation for every value of $\lambda$.

Eigenvalues can be complex even if the matrix is real. For instance,
a rotation by $90^\circ$ has no nonzero real eigenvectors in
$\mathbb{R}^2$; its eigenvalues over $\mathbb{C}$ are $i$ and $-i$.

## The characteristic equation

Rearranging $Av=\lambda v$ gives $(A-\lambda I)v=0$. A nonzero
solution exists exactly when $A-\lambda I$ is singular, so

$$\det(A-\lambda I)=0.$$

For

$$A=\begin{pmatrix}2&1\\0&3\end{pmatrix},$$

the characteristic equation is $(2-\lambda)(3-\lambda)=0$.
Thus $\lambda_1=2$ and $\lambda_2=3$.
For $\lambda_1=2$, an eigenvector is $(1,0)^T$; for
$\lambda_2=3$, an eigenvector is $(1,1)^T$. Verify that
$A(1,0)^T=2(1,0)^T$ and $A(1,1)^T=3(1,1)^T$.

The *eigenspace* corresponding to $\lambda$ is
$\ker(A-\lambda I)$. It includes zero, whereas the set of
eigenvectors excludes zero.

## When is a matrix diagonalizable?

An $n\times n$ matrix is diagonalizable (over a chosen field) when
it has $n$ linearly independent eigenvectors. Then

$$A=PDP^{-1},$$

where columns of $P$ are eigenvectors and $D$ has their eigenvalues
on the diagonal. This makes repeated matrix powers easier:
$A^k=PD^kP^{-1}$ for nonnegative integers $k$.

Distinct eigenvalues guarantee independent corresponding
eigenvectors, but repeated eigenvalues do *not* automatically imply
failure of diagonalizability. Compare the identity matrix, which
has a repeated eigenvalue and many eigenvectors, with

$$J=\begin{pmatrix}2&1\\0&2\end{pmatrix}.$$

The matrix $J$ has a repeated eigenvalue $2$ but only a
one-dimensional eigenspace, so it is not diagonalizable.

The algebraic multiplicity is multiplicity as a root of the
characteristic polynomial; geometric multiplicity is the dimension
of the eigenspace. The latter never exceeds the former.

## Special case: real symmetric matrices

If $A=A^T$ has real entries, the spectral theorem says it has
real eigenvalues and an orthonormal basis of eigenvectors. Hence

$$A=Q\Lambda Q^T,\qquad Q^TQ=I.$$

Covariance matrices in principal component analysis are symmetric
and positive semidefinite. Their eigenvalues are nonnegative, and
their eigenvectors describe orthogonal directions of variance.
For such matrices, use a symmetric eigensolver rather than a
generic one.

## Python experiment

```python
import numpy as np

a = np.array([[2., 1.], [0., 3.]])
values, vectors = np.linalg.eig(a)
for index, value in enumerate(values):
    vector = vectors[:, index]
    print(np.allclose(a @ vector, value * vector))  # True

symmetric = np.array([[2., 1.], [1., 2.]])
real_values, orthonormal_vectors = np.linalg.eigh(symmetric)
print(real_values)  # [1., 3.]
```

Numerically computed eigenvectors may be scaled or sign-reversed;
these represent the same eigendirection. For nearly repeated
eigenvalues, individual eigenvectors can be sensitive to
perturbations even when their invariant subspace is stable.

## Socratic checkpoints

1. Why must we exclude the zero vector from the definition?
2. How does the characteristic equation connect to rank deficiency?
3. Is a real rotation by $90^\circ$ diagonalizable over
   $\mathbb{R}$? What changes over $\mathbb{C}$?
4. If a $3\times3$ matrix has three distinct eigenvalues, what
   follows about diagonalizability?
