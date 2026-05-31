import chess


def apply_move(fen: str, uci: str) -> tuple[str | None, str | None]:
    """Apply UCI move to FEN. Returns (new_fen, error_message)."""
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return None, "Illegal move"
        board.push(move)
        return board.fen(), None
    except ValueError:
        return None, "Invalid move format"


def is_game_over(fen: str) -> bool:
    return chess.Board(fen).is_game_over()


def winner_or_draw(fen: str) -> str | None:
    board = chess.Board(fen)
    if not board.is_game_over():
        return None
    outcome = board.outcome()
    if outcome is None:
        return None
    if outcome.winner is True:
        return "white"
    if outcome.winner is False:
        return "black"
    return "draw"


def _castling_rook_squares(
    board_before: chess.Board, move: chess.Move
) -> dict[int, int]:
    """Map castling rook from_square -> to_square for the side to move."""
    if not board_before.is_castling(move):
        return {}
    side = board_before.turn
    if side == chess.WHITE:
        if move.to_square == chess.G1:
            return {chess.H1: chess.F1}
        if move.to_square == chess.C1:
            return {chess.A1: chess.D1}
    else:
        if move.to_square == chess.G8:
            return {chess.H8: chess.F8}
        if move.to_square == chess.C8:
            return {chess.A8: chess.D8}
    return {}


def _en_passant_captured_square(board_before: chess.Board, move: chess.Move) -> int | None:
    if not board_before.is_en_passant(move):
        return None
    rank_delta = -1 if board_before.turn == chess.WHITE else 1
    return chess.square(
        chess.square_file(move.to_square),
        chess.square_rank(move.to_square) + rank_delta,
    )


def _is_true_king_capture(
    opponent_true_king_square: str | None,
    move: chess.Move,
    board_before: chess.Board,
) -> bool:
    if not opponent_true_king_square:
        return False
    tracked = chess.parse_square(opponent_true_king_square)
    if move.to_square == tracked:
        return True
    ep_sq = _en_passant_captured_square(board_before, move)
    return ep_sq is not None and ep_sq == tracked


def _update_true_king_square(
    square: str | None,
    move: chess.Move,
    board_before: chess.Board,
) -> str | None:
    """Move the tracked true-king location with its piece (including castling rook)."""
    if not square:
        return None
    tracked = chess.parse_square(square)

    if move.from_square == tracked:
        return chess.square_name(move.to_square)

    for rook_from, rook_to in _castling_rook_squares(board_before, move).items():
        if tracked == rook_from:
            return chess.square_name(rook_to)

    return square


def _king_step_moves_ignore_check(
    board: chess.Board, from_square: int
) -> set[chess.Move]:
    """Single-step king moves (and castling if pseudo-legal), ignoring check."""
    moves: set[chess.Move] = set()
    piece = board.piece_at(from_square)
    if not piece or piece.piece_type != chess.KING or piece.color != board.turn:
        return moves

    from_file = chess.square_file(from_square)
    from_rank = chess.square_rank(from_square)

    for to_square in chess.SQUARES:
        if to_square == from_square:
            continue
        target = board.piece_at(to_square)
        if target and target.color == board.turn:
            continue
        to_file = chess.square_file(to_square)
        to_rank = chess.square_rank(to_square)
        if max(abs(from_file - to_file), abs(from_rank - to_rank)) == 1:
            moves.add(chess.Move(from_square, to_square))

    for pseudo in board.pseudo_legal_moves:
        if pseudo.from_square == from_square and board.is_castling(pseudo):
            moves.add(pseudo)

    return moves


def _attacks_square(board: chess.Board, from_square: int, to_square: int) -> bool:
    return bool(board.attacks(from_square) & chess.BB_SQUARES[to_square])


def _pseudo_legal_true_king(
    board: chess.Board,
    move: chess.Move,
    opponent_true_king_square: str | None = None,
) -> bool:
    if move in board.pseudo_legal_moves:
        return True

    piece = board.piece_at(move.from_square)
    if not piece or piece.color != board.turn:
        return False

    if opponent_true_king_square:
        tracked = chess.parse_square(opponent_true_king_square)
        if move.to_square == tracked and _attacks_square(
            board, move.from_square, move.to_square
        ):
            return True

    if piece.piece_type == chess.KING:
        return move in _king_step_moves_ignore_check(board, move.from_square)

    target = board.piece_at(move.to_square)
    if (
        target
        and target.color != board.turn
        and target.piece_type == chess.KING
    ):
        if _attacks_square(board, move.from_square, move.to_square):
            return True
        return _piece_can_reach(board, move)

    return _piece_can_reach(board, move)


def _piece_can_reach(board: chess.Board, move: chess.Move) -> bool:
    """Whether the piece on from_square can move to to_square (ignoring check)."""
    piece = board.piece_at(move.from_square)
    if not piece:
        return False
    for pseudo in board.pseudo_legal_moves:
        if pseudo.from_square == move.from_square and pseudo.to_square == move.to_square:
            if pseudo.promotion == move.promotion:
                return True
    if piece.piece_type == chess.PAWN and move.promotion:
        temp = chess.Move(move.from_square, move.to_square, promotion=move.promotion)
        return temp in board.pseudo_legal_moves
    return False


def apply_move_true_king(
    fen: str,
    uci: str,
    white_true_king: str | None,
    black_true_king: str | None,
) -> tuple[str | None, str | None, str | None, str | None, str | None]:
    """
    Apply move in true-king mode.
    Returns (new_fen, error, winner_color, new_white_tk, new_black_tk).
    winner_color is set when the opponent's true king is captured.
    """
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
    except ValueError:
        return None, "Invalid move format", None, white_true_king, black_true_king

    mover_is_white = board.turn == chess.WHITE
    opponent_tk = black_true_king if mover_is_white else white_true_king

    if not _pseudo_legal_true_king(board, move, opponent_tk):
        return None, "Illegal move", None, white_true_king, black_true_king

    board_before = board.copy()

    if _is_true_king_capture(opponent_tk, move, board_before):
        board.push(move)
        winner = "white" if mover_is_white else "black"
        new_white = _update_true_king_square(white_true_king, move, board_before)
        new_black = _update_true_king_square(black_true_king, move, board_before)
        return board.fen(), None, winner, new_white, new_black

    board.push(move)
    new_white = _update_true_king_square(white_true_king, move, board_before)
    new_black = _update_true_king_square(black_true_king, move, board_before)
    return board.fen(), None, None, new_white, new_black


def validate_true_king_selection(fen: str, square: str, for_white: bool) -> str | None:
    """Return error message if square cannot be chosen as true king."""
    try:
        sq = chess.parse_square(square.lower())
    except ValueError:
        return "Invalid square"
    board = chess.Board(fen)
    piece = board.piece_at(sq)
    if not piece:
        return "No piece on that square"
    if piece.color != (chess.WHITE if for_white else chess.BLACK):
        return "Must select one of your own pieces"
    return None
