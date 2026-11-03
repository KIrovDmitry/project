import networkx as nx
import numpy as np

def generate_er(N: int, p: float):
    G = nx.erdos_renyi_graph(N, p)
    nodes = np.random.uniform(0, 1, (N, 3)).tolist()
    links = list(G.edges())
    return nodes, links

def generate_ba(N: int, m: int):
    if m >= N:
        m = N - 1
    G = nx.barabasi_albert_graph(N, m)
    nodes = np.random.uniform(0, 1, (N, 3)).tolist()
    links = list(G.edges())
    return nodes, links