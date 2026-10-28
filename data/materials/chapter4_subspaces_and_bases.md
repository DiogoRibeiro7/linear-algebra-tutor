---
topic: subspaces and bases
chapter: 4
---

# Subspaces, Span, Linear Independence, and Bases

## What makes a vector space?

A real vector space has addition and scalar multiplication satisfying
the usual closure, associativity, distributivity, identity, and inverse
axioms. The familiar $\mathbb{R}^n$ is a vector space, but so are
polynomials of degree at most $d$ and functions on a fixed domain.

A subset $W\subseteq\mathbb{R}^n$ is a *subspace* precisely when it
contains the zero vector and is closed under vector addition and
scalar multiplication. Equivalently, for every $u,v\in W$ and
$\alpha,\beta\in\mathbb{R}$, the combination
$\alpha u+\beta v$ also belongs to $W$.

The plane $\{(x,y,0):x,y\in\mathbb{R}\}$ is a subspace of
$\mathbb{R}^3$. The parallel plane $\{(x,y,1):x,y\in\mathbb{R}\}$
is not: it does not contain the zero vector.

## Span is the set of all linear combinations

Given $v_1,\ldots,v_k$, their span is

$$\operatorname{span}\{v_1,\ldots,v_k\}
=\left\{\sum_{i=1}^{k}c_iv_i:c_i\in\mathbb{R}\right\}.$$

The span is always a subspace. A vector belongs to the span exactly
when it can be expressed as such a linear combination, so testing
membership amounts to solving a linear system.

Consider

$$u=\begin{pmatrix}1\\0\\1\end{pmatrix},\quad
v=\begin{pmatrix}0\\1\\1\end{pmatrix},\quad
w=\begin{pmatrix}1\\1\\2\end{pmatrix}.$$

Here $w=u+v$. All three vectors lie in the same two-dimensional
plane through the origin. Adding $w$ does not enlarge the span.

## Independence, basis, and coordinates

Vectors $v_1,\dots,v_k$ are linearly independent if

$$c_1v_1+\cdots+c_kv_k=0\quad\Longrightarrow\quad
c_1=\cdots=c_k=0.$$

Otherwise they are dependent. In the preceding example,
$u+v-w=0$ is a nontrivial relation, so the three vectors are
dependent, whereas $u,v$ are independent.

A *basis* of $W$ is a linearly independent set that spans $W$.
Every vector in $W$ then has a unique representation in that basis.
All finite bases of the same space have the same number of vectors;
that number is its dimension. The standard basis of $\mathbb{R}^n$
is $e_1,\ldots,e_n$.

For $u,v$ above, the vector $(2,-1,1)^T$ has coordinates $(2,-1)$
relative to the basis $(u,v)$, since $2u-v=(2,-1,1)^T$. Coordinates
depend on the chosen basis; the underlying vector does not.

## Rank-nullity theorem

For a linear map represented by $A\in\mathbb{R}^{m\times n}$,

$$\dim\ker(A)+\dim\operatorname{im}(A)=n.$$

The image is the column space; its dimension is the rank. The null
space is the set of solutions to $Ax=0$; its dimension is the
nullity. Thus *rank + nullity = number of columns*.

For example,

$$A=\begin{pmatrix}1&2&1\\0&1&1\end{pmatrix}.$$

The two rows are independent, so $\operatorname{rank}(A)=2$.
Solving $Ax=0$ yields $x=t(1,-1,1)^T$, hence nullity is one;
$2+1=3$, the number of columns.

## Python experiment

```python
import numpy as np

u = np.array([1., 0., 1.])
v = np.array([0., 1., 1.])
w = u + v
columns = np.column_stack([u, v, w])
print(np.linalg.matrix_rank(columns))  # 2

a = np.array([[1., 2., 1.], [0., 1., 1.]])
candidate = np.array([1., -1., 1.])
print(np.allclose(a @ candidate, np.zeros(2)))  # True
```

Floating-point rank is estimated using a tolerance, often through
singular values. A numerical rank decision is not an exact proof
of independence for symbolic data.

## Socratic checkpoints

1. Why can no basis contain the zero vector?
2. If three vectors in $\mathbb{R}^2$ are given, can they all be
   linearly independent? Which dimension argument decides?
3. Is the set $\{(x,y):x+y=1\}$ a subspace? Test the zero vector.
4. An $m\times n$ matrix has rank $r$. What is the dimension of the
   solution space of $Ax=0$? What changes if $Ax=b$ is inconsistent?
