import numpy as np
import math

def generate_random(N: int) -> list:
    return np.random.uniform(0, 1, (N, 3)).tolist()

def generate_gaussian(N: int, sigma: float = 0.15) -> list:
    points = []
    center = np.array([0.5, 0.5, 0.5])
    while len(points) < N:
        p = np.random.normal(center, sigma)
        if np.all((p >= 0) & (p <= 1)):
            points.append(p.tolist())
    return points

def generate_grid(N: int) -> list:
    k = max(1, round(N ** (1/3)))
    points = []
    if k == 1:
        return [[0.5, 0.5, 0.5]]
    step = 1.0 / (k - 1)
    for i in range(k):
        for j in range(k):
            for l in range(k):
                if len(points) >= N:
                    return points
                points.append([i * step, j * step, l * step])
    return points

def generate_menger_sponge(N: int) -> list:
    def get_centers(cubes, iteration):
        if iteration == 0:
            return [np.mean(c, axis=0) for c in cubes]
        new_cubes = []
        for cube in cubes:
            min_corner = np.min(cube, axis=0)
            max_corner = np.max(cube, axis=0)
            size = (max_corner - min_corner) / 3
            for i in range(3):
                for j in range(3):
                    for k in range(3):
                        if (i, j, k) == (1, 1, 1):
                            continue
                        if sum(1 for x in (i, j, k) if x == 1) >= 2:
                            continue
                        c1 = min_corner + np.array([i, j, k]) * size
                        c2 = c1 + size
                        new_cubes.append(np.array([
                            c1,
                            [c2[0], c1[1], c1[2]],
                            [c1[0], c2[1], c1[2]],
                            [c2[0], c2[1], c1[2]],
                            [c1[0], c1[1], c2[2]],
                            [c2[0], c1[1], c2[2]],
                            [c1[0], c2[1], c2[2]],
                            c2
                        ]))
        return get_centers(new_cubes, iteration - 1)
    
    iteration = 0
    while 20 ** iteration < N:
        iteration += 1
    
    initial_cube = np.array([
        [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
    ])
    centers = get_centers([initial_cube], iteration)
    
    if len(centers) >= N:
        indices = np.random.choice(len(centers), N, replace=False)
        return [centers[i].tolist() for i in indices]
    else:
        while len(centers) < N:
            centers.append(np.random.uniform(0, 1, 3).tolist())
        return centers

def generate_cantor_dust(N: int) -> list:
    def get_centers(cubes, iteration):
        if iteration == 0:
            return [np.mean(c, axis=0) for c in cubes]
        new_cubes = []
        for cube in cubes:
            min_corner = np.min(cube, axis=0)
            max_corner = np.max(cube, axis=0)
            size = (max_corner - min_corner) / 3
            for i in [0, 2]:
                for j in [0, 2]:
                    for k in [0, 2]:
                        c1 = min_corner + np.array([i, j, k]) * size
                        c2 = c1 + size
                        new_cubes.append(np.array([
                            c1,
                            [c2[0], c1[1], c1[2]],
                            [c1[0], c2[1], c1[2]],
                            [c2[0], c2[1], c1[2]],
                            [c1[0], c1[1], c2[2]],
                            [c2[0], c1[1], c2[2]],
                            [c1[0], c2[1], c2[2]],
                            c2
                        ]))
        return get_centers(new_cubes, iteration - 1)
    
    iteration = 0
    while 8 ** iteration < N:
        iteration += 1
    
    initial_cube = np.array([
        [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
    ])
    centers = get_centers([initial_cube], iteration)
    
    if len(centers) >= N:
        indices = np.random.choice(len(centers), N, replace=False)
        return [centers[i].tolist() for i in indices]
    else:
        while len(centers) < N:
            centers.append(np.random.uniform(0, 1, 3).tolist())
        return centers

def generate_distribution(distribution_type: str, N: int) -> list:
    if distribution_type == 'random':
        return generate_random(N)
    elif distribution_type == 'gaussian':
        return generate_gaussian(N)
    elif distribution_type == 'grid':
        return generate_grid(N)
    elif distribution_type == 'fractal_menger':
        return generate_menger_sponge(N)
    elif distribution_type == 'fractal_cube':
        return generate_cantor_dust(N)
    elif distribution_type in ['fractal_tetrahedron', 'fractal_tetrahedron_cropped',
                                'fractal_octahedron', 'fractal_octahedron_cropped']:
        return generate_random(N)
    else:
        return generate_random(N)