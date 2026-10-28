---
topic: matrices
chapter: 2
---

# Matrices and Matrix Operations

## A matrix is a structured linear map

An $m\times n$ real matrix $A=(a_{ij})$ has $m$ rows and $n$ columns.
Its entry $a_{ij}$ lies in row $i$, column $j$. Matrix dimensions are
part of the mathematics: if $A\in\mathbb{R}^{m\times n}$ and
$x\in\mathbb{R}^n$, then $Ax\in\mathbb{R}^m$.

For example,

$$A=\begin{pmatrix}1&2&-1\\0&3&4\end{pmatrix}
\in\mathbb{R}^{2\times3},\qquad
x=\begin{pmatrix}2\\1\\-1\end{pmatrix},\qquad
Ax=\begin{pmatrix}5\\-1\end{pmatrix}.$$

The first component is $1(2)+2(1)+(-1)(-1)=5$. A useful interpretation
is that $Ax$ combines the columns of $A$ using the coordinates of $x$:

$$Ax=x_1a_1+x_2a_2+\cdots+x_na_n.$$

## Addition, scaling, multiplication

Matrices of the same shape add entrywise; scalar multiplication scales
every entry. Matrix multiplication is different. If
$A\in\mathbb{R}^{m\times n}$ and $B\in\mathbb{R}^{n\times p}$, then
$AB\in\mathbb{R}^{m\times p}$, with

$$(AB)_{ij}=\sum_{k=1}^{n}a_{ik}b_{kj}.$$

The inner dimensions must agree. The result has the *outer* dimensions.
For square matrices, multiplication generally does not commute:

$$A=\begin{pmatrix}1&2\\0&1\end{pmatrix},\quad
B=\begin{pmatrix}2&0\\1&3\end{pmatrix},$$

$$AB=\begin{pmatrix}4&6\\1&3\end{pmatrix},\qquad
BA=\begin{pmatrix}2&4\\1&5\end{pmatrix}.$$

Ask yourself: which row and which column produce the top-right entry
of $AB$? What would the expression $BA$ mean if the shapes differed?

## Identity, transpose, and inverse

The identity $I_n$ has ones on its diagonal and zeros elsewhere. For
compatible matrices $AI=IA=A$. Transposition exchanges rows and
columns: $(A^T)_{ij}=a_{ji}$, and

$$(AB)^T=B^TA^T.$$

The order reversal matters. A square matrix $A$ is invertible when a
matrix $A^{-1}$ exists such that $AA^{-1}=A^{-1}A=I$. Not every square
matrix is invertible; a column that is a linear combination of other
columns prevents invertibility.

For a $2\times2$ matrix,

$$A=\begin{pmatrix}a&b\\c&d\end{pmatrix},\qquad
A^{-1}=\frac{1}{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}$$

provided $ad-bc\ne0$. Never infer that $A^{-1}$ exists merely because
$A$ is square. For solving systems numerically, prefer a linear solver
over explicitly computing an inverse.

## Rank and linear dependence

The rank of $A$ is the dimension of its column space: the number of
linearly independent columns. It also equals the number of pivots in
a row-echelon reduction. A square $n\times n$ matrix is invertible
exactly when its rank is $n$.

## Python check

```python
import numpy as np

a = np.array([[1, 2], [0, 1]], dtype=float)
b = np.array([[2, 0], [1, 3]], dtype=float)

print(a @ b)  # [[4., 6.], [1., 3.]]
print(b @ a)  # [[2., 4.], [1., 5.]]
print(np.linalg.matrix_rank(a))  # 2
print(np.linalg.solve(a, np.array([3., 1.])))  # [1., 1.]
```

## Socratic checkpoints

1. Can a $2\times3$ matrix multiply a $2$-component column vector?
   If not, which dimension fails?
2. Construct two nonzero matrices satisfying $AB\ne BA$.
3. The columns of a $3\times3$ matrix are $u$, $v$, and $u+v$.
   What is the largest possible rank? Can it be invertible?
4. Explain why computing $A^{-1}b$ and solving $Ax=b$ describe the
   same exact mathematical solution when $A$ is invertible, yet need
   not be equally good numerical algorithms.
