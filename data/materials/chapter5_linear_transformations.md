---
topic: linear transformations
chapter: 5
---

# Linear Transformations, Kernel, Image, and Composition

## Linearity is a structural property

A function $T:\mathbb{R}^n\to\mathbb{R}^m$ is linear when for every
$u,v\in\mathbb{R}^n$ and scalar $c$,

$$T(u+v)=T(u)+T(v),\qquad T(cu)=cT(u).$$

Together these imply $T(\alpha u+\beta v)=\alpha T(u)+\beta T(v)$
and $T(0)=0$. Checking the image of zero is a useful first test,
but it is not sufficient by itself to prove linearity.

Every matrix $A\in\mathbb{R}^{m\times n}$ determines a linear map
$T(x)=Ax$. Conversely, every linear map between finite-dimensional
coordinate spaces has a matrix in the chosen bases.

## Build a matrix from what a map does to a basis

Let $e_1,\ldots,e_n$ be the standard basis of $\mathbb{R}^n$.
For any $x=\sum_jx_je_j$, linearity gives

$$T(x)=\sum_{j=1}^{n}x_jT(e_j).$$

Therefore the $j$th column of the standard matrix $A$ is $T(e_j)$.
For example,

$$T(x,y)=(2x,y)\quad\Longleftrightarrow\quad
A=\begin{pmatrix}2&0\\0&1\end{pmatrix}.$$

This is horizontal scaling by a factor of two. It maps the unit
square into a rectangle of area two, showing how a linear map
can change geometry while preserving linear combinations.

## Kernel and image

The *kernel* of $T$ is $\ker(T)=\{x:T(x)=0\}$ and measures which
input directions collapse to zero. The *image* is
$\operatorname{im}(T)=\{T(x):x\in\mathbb{R}^n\}$ and describes
the attainable outputs. Both are subspaces.

For

$$A=\begin{pmatrix}1&2&1\\0&1&1\end{pmatrix},$$

$\ker(A)=\operatorname{span}\{(1,-1,1)^T\}$ and
$\operatorname{im}(A)=\mathbb{R}^2$. This illustrates rank-nullity:
the input dimension three decomposes into kernel dimension one and
image dimension two.

## Composition and matrix order

If $S:\mathbb{R}^p\to\mathbb{R}^n$ is represented by $B$, while
$T:\mathbb{R}^n\to\mathbb{R}^m$ is represented by $A$, then

$$(T\circ S)(x)=T(S(x))=A(Bx)=(AB)x.$$

The matrix nearest the input acts *first*. Thus order matters, just
as it does for multiplying matrices. Consider rotation by $90^\circ$:

$$R=\begin{pmatrix}0&-1\\1&0\end{pmatrix},\qquad
R(1,0)^T=(0,1)^T.$$

If you first stretch horizontally and then rotate, you obtain
$RA$. If you rotate first and then stretch, you obtain $AR$.
The two transformations need not agree.

## Linear versus affine versus nonlinear

The map $F(x)=Ax+b$ is *affine*. It is linear only when $b=0$;
translations generally move the origin. The scalar function
$f(x)=x^2$ is nonlinear because $f(2x)\ne2f(x)$ for most $x$.
These distinctions matter in computer graphics and machine
learning, where an affine layer can contain a bias term.

## Python experiment

```python
import numpy as np

stretch = np.diag([2., 1.])
rotate = np.array([[0., -1.], [1., 0.]])
vector = np.array([1., 0.])

print(rotate @ stretch @ vector)  # [0., 2.]
print(stretch @ rotate @ vector)  # [0., 1.]
print(np.linalg.matrix_rank(stretch))  # 2
```

## Socratic checkpoints

1. What can you conclude immediately if a proposed linear map has
   $T(0)\ne0$?
2. If you know $T(e_1)$ and $T(e_2)$, how do you find $T(3,-2)$?
3. Why is the kernel of an invertible square matrix only $\{0\}$?
4. In a sequence of two matrix transformations, which one acts first:
   the left or the right factor?
